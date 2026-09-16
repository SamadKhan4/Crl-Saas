import { useEffect, useRef, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
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
import { calculateCharges } from '../lib/charges';
import { calculateGoods } from '../lib/goods';
import { idOf } from '../lib/workflow';
import { copyText } from '../lib/clipboard';
import { LrPdfDownload } from '../Template/LrPdf';

const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const creditChargeNames = ['freightCharges', 'fuelCharges', 'handlingCharges', 'fodCharges', 'codCharges', 'rovCharges', 'docketCharges', 'gstRate'];
const money = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

function PrintInputGrid({ fields, register, errors, readOnlyFields = [] }) {
  return (
    <div className="form-grid">
      {fields.map(([name, label, type = 'text']) => (
        <FormField key={name} label={label} type={type} readOnly={name === 'bookingDate' || name === 'invoiceDate' || readOnlyFields.includes(name)} step={type === 'number' ? 'any' : undefined} min={type === 'number' ? 0 : undefined} {...register(name)} error={errors[name]?.message} />
      ))}
    </div>
  );
}

export function shipmentCreatePayload(values) {
  const { packageCount, ...totals } = calculateGoods(values.goods);
  values = { ...values, ...totals, ...calculateCharges(values), packageCount, weightKg: totals.actualWeight };
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
      goods: [emptyGoods()],
    },
  });
  const [route, setRoute] = useState({ from: null, to: null });
  const goods = useWatch({ control, name: 'goods' });
  const isCreditCustomer = selectedCustomer?.customerType === 'CREDIT';
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
    if (!isCreditCustomer)
      for (const name of creditChargeNames) setValue(name, '', { shouldValidate: true });
  }, [selectedCustomer, isCreditCustomer, setValue]);
  useEffect(() => {
    if (!isCreditCustomer) return;
    const rates = selectedCustomer.creditCharges || {};
    const totals = calculateGoods(goods);
    const units = rates.freightBasis === 'PER_BOX' ? totals.packageCount : totals.chargedWeight;
    const freightCharges = money(Number(rates.freightRate || 0) * Number(units || 0));
    const charges = {
      freightCharges,
      fuelCharges: money(freightCharges * Number(rates.fuelRatePercent || 0) / 100),
      handlingCharges: rates.handlingCharges || 0,
      fodCharges: rates.fodCharges || 0,
      codCharges: rates.codCharges || 0,
      rovCharges: money(totals.declaredValue * Number(rates.rovRatePercent || 0) / 100),
      docketCharges: rates.docketCharges || 0,
      gstRate: rates.gstRate || 0,
    };
    for (const [name, value] of Object.entries(charges)) setValue(name, value, { shouldValidate: true });
  }, [goods, isCreditCustomer, selectedCustomer, setValue]);
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
              setRoute({ from: null, to: null });
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
            <Link className="table-action" to={`${base}/customers?create=true`}>
              <Plus size={16} /> New customer
            </Link>
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
              <p>Find Vidarbha From and To areas by name or PIN code.</p>
            </div>
          </div>
          <div className="form-grid">
            <DestinationLookup label="From" value={route.from} error={errors.from?.message} onChange={(place) => {
              setRoute((current) => ({ ...current, from: place }));
              setValue('from', place ? `${place.name}, ${place.district} - ${place.pincode}` : '', { shouldValidate: true });
              setValue('consignorPincode', place?.pincode || '', { shouldValidate: true });
            }} />
            <DestinationLookup label="To" value={route.to} error={errors.to?.message} onChange={(place) => {
              setRoute((current) => ({ ...current, to: place }));
              setValue('to', place ? `${place.name}, ${place.district} - ${place.pincode}` : '', { shouldValidate: true });
              setValue('consigneePincode', place?.pincode || '', { shouldValidate: true });
            }} />
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
          <div className="section-title"><span>06</span><div><h2>Payment, risk & charges</h2><p>These selections and amounts print in the lower-right LR grid.</p></div></div>
          <div className="form-grid">
            <Controller control={control} name="paymentMode" render={({ field }) => <div className="field"><label htmlFor="paymentMode">Mode of payment</label><select id="paymentMode" {...field} disabled={isCreditCustomer}><option value="">Select</option><option value="PAID">Paid</option><option value="TO_PAY">To Pay</option><option value="CREDIT">Credit</option></select><small className="field-error">{errors.paymentMode?.message}</small></div>} />
            <div className="field"><label htmlFor="riskType">Risk type</label><select id="riskType" {...register('riskType')}><option value="">Select</option><option value="CARRIER_RISK">Carrier risk</option><option value="OWNER_RISK">Owner risk</option></select><small className="field-error">{errors.riskType?.message}</small></div>
            <div className="field"><label htmlFor="insuranceType">Insurance</label><select id="insuranceType" {...register('insuranceType')}><option value="">Select</option><option value="INSURED">Insured</option><option value="NOT_INSURED">Not insured</option></select><small className="field-error">{errors.insuranceType?.message}</small></div>
          </div>
          <PrintInputGrid
            register={register}
            errors={errors}
            readOnlyFields={isCreditCustomer ? creditChargeNames : []}
            fields={[
              ['freightCharges', 'Freight charges', 'number'],
              ['fuelCharges', 'Fuel charges', 'number'],
              ['handlingCharges', 'Handling charges', 'number'],
              ['fodCharges', 'FOD charges', 'number'],
              ['codCharges', 'COD charges', 'number'],
              ['rovCharges', 'ROV charges', 'number'],
              ['docketCharges', 'Docket charges', 'number'],
              ['gstRate', 'GST rate (%)', 'number'],
            ]}
          />
          <ChargeTotals control={control} />
        </section>
        <section className="panel form-section">
          <div className="section-title"><span>07</span><div><h2>Signatures & remarks</h2><p>Enter the text that must print in the signature and remarks boxes.</p></div></div>
          <PrintInputGrid
            register={register}
            errors={errors}
            fields={[
              ['shipperSignature', 'Shipper signature'],
              ['receiverNamePrint', "Receiver's name"],
              ['receiverMobilePrint', 'Receiver mobile number'],
              ['receiverDateTime', 'Receiver date & time', 'datetime-local'],
              ['receiverSignature', 'Receiver signature'],
            ]}
          />
          <div className="field"><label htmlFor="remarks">Remarks</label><textarea id="remarks" rows="3" maxLength="250" {...register('remarks')} /><small className="field-error">{errors.remarks?.message}</small></div>
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
