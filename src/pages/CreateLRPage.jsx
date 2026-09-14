import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CheckCircle2, Copy, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { lrCreateSchema, lrPrintFieldNames, shipmentSchema } from '../schemas';
import { shipmentsApi } from '../api/services';
import { errorMessage, formErrors } from '../api/client';
import { useAuth } from '../features/auth/AuthContext';
import { PageHeader, FormField } from '../components/common/UI';
import Lookup from '../components/forms/Lookup';
import { idOf } from '../lib/workflow';
import { copyText } from '../lib/clipboard';
import { LrPdfDownload } from '../Template/LrPdf';

function PrintInputGrid({ fields, register, errors }) {
  return (
    <div className="form-grid">
      {fields.map(([name, label, type = 'text']) => (
        <FormField key={name} label={label} type={type} {...register(name)} error={errors[name]?.message} />
      ))}
    </div>
  );
}

export function shipmentCreatePayload(values) {
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
    [error, setError] = useState('');
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError: fieldError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(lrCreateSchema),
    defaultValues: {
      originBranchId: user.role !== 'ADMIN' ? idOf(user.branchId) : '',
      packageCount: 1,
    },
  });
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
    }
  }
  if (created)
    return (
      <section className="panel success-panel">
        <CheckCircle2 size={48} />
        <span className="eyebrow">LR GENERATED SUCCESSFULLY</span>
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
          <Controller
            control={control}
            name="customerId"
            render={({ field }) => <Lookup resource="customers" label="Customer" {...field} />}
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
              <p>Choose your branches and package details.</p>
            </div>
          </div>
          <div className="form-grid">
            {['originBranchId', 'destinationBranchId'].map((key) => (
              <div key={key}>
                <Controller
                  control={control}
                  name={key}
                  render={({ field }) => (
                    <Lookup
                      resource="branches"
                      label={key === 'originBranchId' ? 'Origin branch' : 'Destination branch'}
                      branchOptions={key === 'destinationBranchId'}
                      ownBranch={
                        user.role !== 'ADMIN' && key === 'originBranchId'
                          ? idOf(user.branchId)
                          : undefined
                      }
                      {...field}
                    />
                  )}
                />
                <small className="field-error">{errors[key]?.message}</small>
              </div>
            ))}
            <FormField
              label="Package count"
              type="number"
              min="1"
              max="10000"
              {...register('packageCount')}
              error={errors.packageCount?.message}
            />
            <FormField
              label="Total weight (kg)"
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
              ['from', 'From'],
              ['to', 'To'],
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
          <PrintInputGrid
            register={register}
            errors={errors}
            fields={[
              ['packageNumber', 'Pkg. No.'],
              ['packageType', 'Package type'],
              ['actualWeight', 'Actual weight (kg)', 'number'],
              ['chargedWeight', 'Charged weight (kg)', 'number'],
              ['dimensions', 'Dimensions (L x B x H) cm'],
              ['volume', 'Volume'],
              ['declaredValue', 'Declared value (Rs)', 'number'],
            ]}
          />
        </section>
        <section className="panel form-section">
          <div className="section-title"><span>06</span><div><h2>Payment, risk & charges</h2><p>These selections and amounts print in the lower-right LR grid.</p></div></div>
          <div className="form-grid">
            <div className="field"><label htmlFor="paymentMode">Mode of payment</label><select id="paymentMode" {...register('paymentMode')}><option value="">Select</option><option value="PAID">Paid</option><option value="TO_PAY">To Pay</option><option value="CREDIT">Credit</option></select><small className="field-error">{errors.paymentMode?.message}</small></div>
            <div className="field"><label htmlFor="riskType">Risk type</label><select id="riskType" {...register('riskType')}><option value="">Select</option><option value="CARRIER_RISK">Carrier risk</option><option value="OWNER_RISK">Owner risk</option></select><small className="field-error">{errors.riskType?.message}</small></div>
            <div className="field"><label htmlFor="insuranceType">Insurance</label><select id="insuranceType" {...register('insuranceType')}><option value="">Select</option><option value="INSURED">Insured</option><option value="NOT_INSURED">Not insured</option></select><small className="field-error">{errors.insuranceType?.message}</small></div>
          </div>
          <PrintInputGrid
            register={register}
            errors={errors}
            fields={[
              ['freightCharges', 'Freight charges', 'number'],
              ['fuelCharges', 'Fuel charges', 'number'],
              ['handlingCharges', 'Handling charges', 'number'],
              ['fodCodCharges', 'FOD / COD charges', 'number'],
              ['rovCharges', 'ROV charges', 'number'],
              ['docketCharges', 'Docket charges', 'number'],
              ['gstRate', 'GST rate (%)', 'number'],
              ['gstAmount', 'GST amount', 'number'],
              ['totalAmount', 'Total amount', 'number'],
            ]}
          />
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
          <span>The LR number and booking date are generated automatically.</span>
          <button className="btn" disabled={isSubmitting}>
            {isSubmitting ? 'Creating LR…' : 'Generate LR'}
            <Plus size={17} />
          </button>
        </div>
      </form>
    </>
  );
}
