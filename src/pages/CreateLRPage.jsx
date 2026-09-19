import { useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CheckCircle2, Copy, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { lrCreateSchema, lrPrintFieldNames, shipmentSchema } from '../schemas';
import { shipmentsApi } from '../api/services';
import { errorMessage, formErrors, get } from '../api/client';
import { useAuth } from '../features/auth/AuthContext';
import { PageHeader, FormField } from '../components/common/UI';
import CustomerCodeLookup from '../components/forms/CustomerCodeLookup';
import GoodsFields, { emptyGoods } from '../components/forms/GoodsFields';
import ChargeTotals from '../components/forms/ChargeTotals';
import DestinationLookup from '../components/forms/DestinationLookup';
import CreditDestinationSelect from '../components/forms/CreditDestinationSelect';
import { calculateCharges } from '../lib/charges';
import { calculateGoods } from '../lib/goods';
import { addTransitDays } from '../data/serviceLocations';
import { idOf } from '../lib/workflow';
import { copyText } from '../lib/clipboard';
import { LrPdfDownload } from '../Template/LrPdf';

const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const pricingFieldNames = ['freightRate', 'fuelRatePercent', 'handlingCharges', 'fodCharges', 'codCharges', 'rovRatePercent', 'docketCharges', 'gstRate'];
const customerChargeFieldNames = pricingFieldNames.filter((name) => name !== 'freightRate');
const signatureFieldNames = ['shipperSignature', 'receiverNamePrint', 'receiverMobilePrint', 'receiverDateTime', 'receiverSignature'];
const nagpurOrigin = Object.freeze({ id: 'origin-nagpur', name: 'Nagpur', district: 'Nagpur' });

function PrintInputGrid({ fields, register, errors, readOnlyFields = [] }) {
  return (
    <div className="form-grid">
      {fields.map(([name, label, type = 'text']) => (
        <FormField key={name} label={label} type={type} readOnly={name === 'bookingDate' || name === 'invoiceDate' || readOnlyFields.includes(name)} step={type === 'number' ? 'any' : undefined} min={type === 'number' ? 0 : undefined} {...register(name)} error={errors[name]?.message} />
      ))}
    </div>
  );
}

function PricingFields({ register, errors, disabled = false }) {
  return (
    <div className="form-grid lr-pricing-fields">
      <div className="field">
        <label htmlFor="freightBasis">Freight calculation</label>
        <select id="freightBasis" disabled={disabled} {...register('freightBasis')}>
          <option value="PER_KG">Per charged kg</option>
          <option value="PER_BOX">Per box</option>
          <option value="FIXED">Fixed freight</option>
        </select>
        <small className="field-error">{errors.freightBasis?.message}</small>
      </div>
      {[
        ['freightRate', 'Freight rate / fixed amount'],
        ['fuelRatePercent', 'Fuel charge (% of freight)'],
        ['handlingCharges', 'Handling charges'],
        ['fodCharges', 'FOD charges'],
        ['codCharges', 'COD charges'],
        ['rovRatePercent', 'ROV (% of declared value)'],
        ['docketCharges', 'Docket charges'],
        ['gstRate', 'GST rate (%)'],
      ].map(([name, label]) => (
        <FormField key={name} label={label} type="number" min="0" max={name.endsWith('Percent') || name === 'gstRate' ? 100 : undefined} step="any" disabled={disabled} {...register(name)} error={errors[name]?.message} />
      ))}
    </div>
  );
}

export function shipmentCreatePayload(values) {
  const { packageCount, ...totals } = calculateGoods(values.goods);
  const pricedValues = { ...values, ...totals, packageCount };
  values = { ...pricedValues, ...calculateCharges(pricedValues), weightKg: totals.actualWeight };
  const shipment = shipmentSchema.parse(values);
  const lrDetails = Object.fromEntries(
    lrPrintFieldNames
      .filter((key) => values[key] !== undefined)
      .map((key) => [key, values[key]]),
  );
  return Object.keys(lrDetails).length ? { ...shipment, lrDetails } : shipment;
}

export default function CreateLRPage() {
  const { user } = useAuth(),
    base = `/${user.role.toLowerCase()}`;
  const cache = useQueryClient();
  const request = useRef({ key: crypto.randomUUID(), body: null });
  const [created, setCreated] = useState(null),
    [selectedCustomer, setSelectedCustomer] = useState(null),
    [error, setError] = useState('');
  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    getValues,
    clearErrors,
    setError: fieldError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(lrCreateSchema),
    defaultValues: {
      originBranchId: user.role !== 'ADMIN' ? idOf(user.branchId) : '',
      packageCount: 1,
      lrNumber: '',
      bookingDate: today(),
      invoiceDate: today(),
      paymentMode: '',
      freightBasis: 'PER_KG',
      freightRate: 0,
      fuelRatePercent: 0,
      handlingCharges: 0,
      fodCharges: 0,
      codCharges: 0,
      rovRatePercent: 0,
      docketCharges: 0,
      gstRate: 0,
      declaredValue: '',
      from: 'Nagpur',
      goods: [emptyGoods()],
    },
  });
  const [route, setRoute] = useState({ from: nagpurOrigin, to: null });
  const isCreditCustomer = selectedCustomer?.customerType === 'CREDIT';
  const signaturesLocked = user.role === 'EMPLOYEE';
  useEffect(() => {
    if (!selectedCustomer) return;
    const values = {
      consignorCode: selectedCustomer.customerCode,
      senderName: selectedCustomer.name,
      consignorAddress: selectedCustomer.address || '',
      consignorPincode: selectedCustomer.pincode || '',
      consignorGstin: selectedCustomer.gstNumber || '',
    };
    for (const [name, value] of Object.entries(values)) setValue(name, value, { shouldValidate: true });
    setValue('paymentMode', isCreditCustomer ? 'CREDIT' : '', { shouldValidate: true });
    setValue('freightBasis', 'PER_KG', { shouldValidate: true });
    for (const name of pricingFieldNames) setValue(name, 0, { shouldValidate: true });
    if (isCreditCustomer) {
      for (const name of customerChargeFieldNames)
        setValue(name, Number(selectedCustomer.creditCharges?.[name] || 0), { shouldValidate: true });
    }
    setRoute((current) => ({ ...current, to: null }));
    setValue('to', '', { shouldValidate: false });
    clearErrors('to');
    setValue('expectedDeliveryDate', '', { shouldValidate: true });
  }, [selectedCustomer, isCreditCustomer, setValue, clearErrors]);
  const branches = useQuery({ queryKey: ['branches', 'route-options'], queryFn: () => get('/branches/options') });
  useEffect(() => {
    const options = branches.data?.data || [];
    if (!options.length) return;
    const originId = user.role === 'ADMIN' ? idOf(options.find((branch) => route.from && `${branch.name} ${branch.city}`.toLowerCase().includes(route.from.district.toLowerCase())) || options[0]) : idOf(user.branchId);
    const destinationId = idOf(options.find((branch) => route.to && `${branch.name} ${branch.city}`.toLowerCase().includes(route.to.district.toLowerCase()) && idOf(branch) !== originId) || options.find((branch) => idOf(branch) !== originId)) || originId;
    if (originId) setValue('originBranchId', originId, { shouldValidate: true });
    if (destinationId) setValue('destinationBranchId', destinationId, { shouldValidate: true });
  }, [branches.data, route.from, route.to, setValue, user.branchId, user.role]);
  async function submit(values) {
    setError('');
    const shipmentPayload = shipmentCreatePayload(values);
    const serialized = JSON.stringify(shipmentPayload);
    if (request.current.body !== serialized) {
      request.current = { key: crypto.randomUUID(), body: serialized };
    }
    try {
      const result = await shipmentsApi.create(shipmentPayload, request.current.key);
      setCreated({
        ...result.data,
        lrDetails: { ...shipmentPayload.lrDetails, ...result.data.lrDetails },
      });
      cache.invalidateQueries({ queryKey: ['shipments'] });
      cache.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Shipment created');
    } catch (e) {
      setError(errorMessage(e));
      formErrors(e, fieldError);
      if (e.response?.data?.errorCode === 'LR_NUMBER_EXISTS') fieldError('lrNumber', { message: 'This LR number already exists' });
    }
  }
  if (created)
    return (
      <section className="panel success-panel">
        <CheckCircle2 size={48} />
        <span className="eyebrow">LR CREATED SUCCESSFULLY</span>
        <h1>{created.lrNumber}</h1>
        <p>Your shipment is booked and ready for dispatch.</p>
        <div className="actions">
          <Link className="btn" to={`${base}/shipments/${idOf(created)}`}>
            View shipment
          </Link>
          <button
            className="btn secondary"
            onClick={() =>
              copyText(created.lrNumber)
                .then(() => toast.success('LR number copied'))
                .catch(() => toast.error('Unable to copy'))
            }
          >
            <Copy size={16} /> Copy LR
          </button>
          <LrPdfDownload shipment={created} />
          <button
            className="btn secondary"
            onClick={() => {
              setCreated(null);
              reset();
              setSelectedCustomer(null);
              setRoute({ from: nagpurOrigin, to: null });
              request.current = { key: crypto.randomUUID(), body: null };
            }}
          >
            Create another LR
          </button>
        </div>
      </section>
    );
  return (
    <>
      <PageHeader
        title="Create a new LR"
        description="Start a shipment with accurate details, from the first mile."
      >
        <Link className="btn secondary" to={`${base}/shipments`}>
          Back to shipments
        </Link>
      </PageHeader>
      <form onSubmit={handleSubmit(submit)} className="lr-form">
        <section className="panel form-section">
          <div className="section-title">
            <span>01</span>
            <div>
              <h2>Customer</h2>
              <p>Select the customer for this booking.</p>
            </div>
            {user.role !== 'EMPLOYEE' && (
              <Link className="table-action" to={`${base}/customers?create=true`}>
                <Plus size={16} /> New customer
              </Link>
            )}
          </div>
          <FormField label="LR number" placeholder="Enter LR number" maxLength={50} {...register('lrNumber')} error={errors.lrNumber?.message} />
          <Controller
            control={control}
            name="customerId"
            render={({ field }) => <CustomerCodeLookup {...field} onCustomer={setSelectedCustomer} />}
          />
          {errors.customerId && <small className="field-error">{errors.customerId.message}</small>}
        </section>
        <section className="panel form-section">
          <div className="section-title">
            <span>02</span>
            <div>
              <h2>Consignor & consignee</h2>
              <p>Fill the party details exactly as they must appear on the LR.</p>
            </div>
          </div>
          <div className="form-grid">
            {[
              ['consignorCode', 'Consignor code'],
              ['senderName', 'Consignor name'],
              ['consignorAddress', 'Consignor address - line 1'],
              ['consignorAddress2', 'Consignor address - line 2'],
              ['consignorPincode', 'Consignor PIN code'],
              ['consignorGstin', 'Consignor GSTIN'],
              ['receiverName', 'Consignee name'],
              ['consigneeAddress', 'Consignee address - line 1'],
              ['consigneeAddress2', 'Consignee address - line 2'],
              ['consigneeAddress3', 'Consignee address - line 3'],
              ['consigneePincode', 'Consignee PIN code'],
              ['consigneeGstin', 'Consignee GSTIN'],
              ['receiverMobile', 'Consignee mobile'],
            ].map(([key, caption]) => (
              <FormField
                key={key}
                label={caption}
                {...register(key)}
                error={errors[key]?.message}
              />
            ))}
          </div>
        </section>
        <section className="panel form-section">
          <div className="section-title">
            <span>03</span>
            <div>
              <h2>Route & shipment</h2>
              <p>From is fixed at Nagpur. Select To from CRL service locations.</p>
            </div>
          </div>
          <div className="form-grid">
            <FormField label="From" readOnly {...register('from')} error={errors.from?.message} />
            {isCreditCustomer ? (
              <CreditDestinationSelect
                rates={selectedCustomer.creditRateCard}
                value={route.to}
                error={errors.to ? 'Select a contracted location' : ''}
                onChange={(place) => {
                  setRoute((current) => ({ ...current, to: place }));
                  setValue('to', place?.name || '', { shouldValidate: true });
                  setValue('freightBasis', 'PER_KG', { shouldValidate: true });
                  setValue('freightRate', place?.ratePerKg || 0, { shouldValidate: true });
                  setValue(
                    'expectedDeliveryDate',
                    place ? addTransitDays(getValues('bookingDate'), place.transitDays) : '',
                    { shouldValidate: true },
                  );
                }}
              />
            ) : (
              <DestinationLookup label="To" value={route.to} error={errors.to?.message} onChange={(place) => {
                setRoute((current) => ({ ...current, to: place }));
                setValue('to', place?.name || '', { shouldValidate: true });
                setValue(
                  'expectedDeliveryDate',
                  place ? addTransitDays(getValues('bookingDate'), place.transitDays) : '',
                  { shouldValidate: true },
                );
              }} />
            )}
            <FormField
              label="Package count"
              readOnly
              type="number"
              min="1"
              max="10000"
              {...register('packageCount')}
              error={errors.packageCount?.message}
            />
            <FormField
              label="Total weight (kg)"
              readOnly
              type="number"
              min="0.001"
              step="any"
              {...register('weightKg')}
              error={errors.weightKg?.message}
            />
            <FormField
              label="Expected delivery"
              type="date"
              {...register('expectedDeliveryDate')}
              error={errors.expectedDeliveryDate?.message}
            />
            <div className="field">
              <label htmlFor="description">Description of goods</label>
              <textarea id="description" rows="3" maxLength={500} {...register('description')} />
              <small className="field-error">{errors.description?.message}</small>
            </div>
          </div>
          <PrintInputGrid
            register={register}
            errors={errors}
            fields={[
              ['bookingDate', 'Booking date', 'date'],
              ['bookingBranch', 'Booking branch'],
              ['deliveryAddress', 'Delivery address (if different)'],
              ['contactNo', 'Contact number'],
            ]}
          />
        </section>
        <section className="panel form-section">
          <div className="section-title"><span>04</span><div><h2>Reference & document details</h2><p>These fields appear in the reference block of the LR.</p></div></div>
          <PrintInputGrid
            register={register}
            errors={errors}
            fields={[
              ['invoiceNo', 'Invoice number'],
              ['invoiceDate', 'Invoice date', 'date'],
              ['eWayBillNo', 'E-Way Bill number'],
              ['eWayBillDate', 'E-Way Bill date', 'date'],
              ['poStnNo', 'PO / STN. number'],
              ['customerReference', 'Customer reference'],
            ]}
          />
        </section>
        <section className="panel form-section">
          <div className="section-title"><span>05</span><div><h2>Goods details</h2><p>Fill each printed goods-table field.</p></div></div>
          <GoodsFields control={control} register={register} setValue={setValue} errors={errors} />
        </section>
        <section className="panel form-section">
          <div className="section-title"><span>06</span><div><h2>Payment, risk & charges</h2><p>Freight calculates automatically from customer, destination and chargeable weight.</p></div></div>
          {selectedCustomer && <p className="form-hint">Pricing for <strong>{selectedCustomer.name}</strong> ({isCreditCustomer ? 'Credit' : 'To Pay / Paid'} customer)</p>}
          <div className="form-grid">
            <Controller control={control} name="paymentMode" render={({ field }) => <div className="field"><label htmlFor="paymentMode">Mode of payment</label><select id="paymentMode" {...field} disabled={!selectedCustomer || isCreditCustomer}><option value="">Select</option><option value="PAID">Paid</option><option value="TO_PAY">To Pay</option>{isCreditCustomer && <option value="CREDIT">Credit</option>}</select><small className="field-error">{errors.paymentMode?.message}</small></div>} />
            <div className="field"><label htmlFor="riskType">Risk type</label><select id="riskType" {...register('riskType')}><option value="">Select</option><option value="CARRIER_RISK">Carrier risk</option><option value="OWNER_RISK">Owner risk</option></select><small className="field-error">{errors.riskType?.message}</small></div>
            <div className="field"><label htmlFor="insuranceType">Insurance</label><select id="insuranceType" {...register('insuranceType')}><option value="">Select</option><option value="INSURED">Insured</option><option value="NOT_INSURED">Not insured</option></select><small className="field-error">{errors.insuranceType?.message}</small></div>
          </div>
          {!selectedCustomer && <p className="form-hint">Select a customer to define LR charges.</p>}
          {selectedCustomer && !isCreditCustomer && <PricingFields register={register} errors={errors} />}
          {isCreditCustomer && (
            <div className="credit-pricing-summary">
              <div><small>Contracted location</small><strong>{route.to?.name || 'Select destination'}</strong></div>
              <div><small>Freight rate</small><strong>{route.to ? `₹${Number(route.to.ratePerKg).toLocaleString('en-IN')} / kg` : '—'}</strong></div>
              <div><small>Transit time</small><strong>{route.to ? `${route.to.transitDays} ${route.to.transitDays === 1 ? 'day' : 'days'}` : '—'}</strong></div>
              <p>Freight and additional charges are locked from Customer Master. Chargeable weight uses the higher of actual and volumetric weight.</p>
            </div>
          )}
          <ChargeTotals control={control} />
        </section>
        <section className={`panel form-section ${signaturesLocked ? 'employee-locked-section' : ''}`} aria-disabled={signaturesLocked}>
          <div className="section-title"><span>07</span><div><h2>Signatures & remarks</h2><p>{signaturesLocked ? 'Locked for Employee role. Admin or Manager can update this section.' : 'Enter the text that must print in the signature and remarks boxes.'}</p></div>{signaturesLocked && <strong className="locked-badge">Locked</strong>}</div>
          <PrintInputGrid
            register={register}
            errors={errors}
            readOnlyFields={signaturesLocked ? signatureFieldNames : []}
            fields={[
              ['shipperSignature', 'Shipper signature'],
              ['receiverNamePrint', "Receiver's name"],
              ['receiverMobilePrint', 'Receiver mobile number'],
              ['receiverDateTime', 'Receiver date & time', 'datetime-local'],
              ['receiverSignature', 'Receiver signature'],
            ]}
          />
          <div className="field"><label htmlFor="remarks">Remarks</label><textarea id="remarks" rows="3" maxLength="250" readOnly={signaturesLocked} {...register('remarks')} /><small className="field-error">{errors.remarks?.message}</small></div>
        </section>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <span>Enter your LR number. Chargeable weight uses the higher of total actual and volumetric weight.</span>
          <button className="btn" disabled={isSubmitting}>
            {isSubmitting ? 'Creating LR…' : 'Create LR'}
            <Plus size={17} />
          </button>
        </div>
      </form>
    </>
  );
}
