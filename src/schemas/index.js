import { z } from 'zod';
const text = (min, max) => z.string().trim().min(min).max(max);
const password = (min) => z.string().min(min).max(128);
const optional = (schema) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema.optional());
const mobile = z.string().regex(/^\+?[1-9]\d{7,14}$/, 'Enter a valid mobile number');
const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Select a valid record');
export const loginSchema = z.object({ email: z.email(), password: password(8) });
const customerCharge = z.coerce.number().finite().min(0).max(100000000);
const creditChargesSchema = z.object({
  freightBasis: z.enum(['PER_KG', 'PER_BOX']),
  freightRate: customerCharge,
  fuelRatePercent: customerCharge.max(100),
  handlingCharges: customerCharge,
  fodCharges: customerCharge,
  codCharges: customerCharge,
  rovRatePercent: customerCharge.max(100),
  docketCharges: customerCharge,
  gstRate: customerCharge.max(100),
});
export const customerSchema = z.object({
  customerType: z.enum(['CREDIT', 'TO_PAY_PAID']),
  creditCharges: creditChargesSchema.optional(),
  name: text(2, 120),
  companyName: text(0, 150).optional(),
  mobile,
  alternateMobile: optional(mobile),
  email: optional(z.email()),
  address: text(0, 250).optional(),
  city: text(0, 80).optional(),
  state: text(0, 80).optional(),
  pincode: optional(z.string().regex(/^\d{6}$/, 'Enter a 6-digit pincode')),
  gstNumber: optional(
    z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^\d{2}[A-Z]{5}\d{4}[A-Z]\dZ[A-Z\d]$/, 'Enter a valid GST number'),
  ),
}).superRefine((data, ctx) => {
  if (data.customerType === 'CREDIT' && !data.creditCharges)
    ctx.addIssue({ code: 'custom', path: ['creditCharges'], message: 'Enter credit customer charges' });
});
export const branchSchema = z.object({
  branchCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{2,20}$/, 'Use 2–20 letters, numbers or hyphens'),
  name: text(2, 100),
  city: text(2, 80),
  state: text(0, 80).optional(),
  address: text(0, 250).optional(),
  pincode: optional(z.string().regex(/^\d{6}$/)),
  phone: optional(mobile),
  email: optional(z.email()),
});
export const userSchema = z.object({
  name: text(2, 100),
  email: z.email(),
  mobile: optional(mobile),
  branchId: objectId,
  password: password(12),
});
export const shipmentFields = z.object({
  senderName: text(2, 120),
  receiverName: text(2, 120),
  receiverMobile: optional(mobile),
  packageCount: z.coerce.number().int().min(1).max(10000),
  weightKg: z.coerce.number().min(0.01).max(100000),
  description: text(0, 500).optional(),
  expectedDeliveryDate: optional(
    z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Enter a valid date'),
  ),
});
const manualLrNumber = z.string().trim().toUpperCase().min(1, 'Enter LR number').max(50)
  .regex(/^[A-Z0-9][A-Z0-9/._-]*$/, 'Use letters, numbers, /, ., _ or -');
export const shipmentSchema = shipmentFields
  .extend({ lrNumber: manualLrNumber, customerId: objectId, originBranchId: objectId, destinationBranchId: objectId });
const lrPrintText = optional(z.string().trim().max(250));
const lrPrintDate = optional(
  z.string().refine((value) => !Number.isNaN(Date.parse(value)), 'Enter a valid date'),
);
const lrAmount = optional(z.coerce.number().finite().min(0).max(100000000));
const lrPositiveAmount = optional(z.coerce.number().finite().positive().max(100000000));
const lrGstin = optional(
  z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^\d{2}[A-Z]{5}\d{4}[A-Z]\dZ[A-Z\d]$/, 'Enter a valid GST number'),
);
const goodsNumber = z.coerce.number().finite().positive().max(100000);
const goodsDimension = z.preprocess((value) => value === '' ? undefined : value, goodsNumber.optional());
export const goodsSchema = z.object({
  packageNumber: z.string().trim().max(80).optional(),
  description: z.string().trim().min(1, 'Enter goods description').max(500),
  packageType: z.string().trim().max(120).optional(),
  quantity: z.coerce.number().int().min(1).max(10000),
  actualWeight: z.coerce.number().finite().min(0.01).max(100000),
  length: goodsDimension, breadth: goodsDimension, height: goodsDimension,
  dimensionUnit: z.enum(['CM', 'IN', 'FT']),
  declaredValue: z.preprocess((value) => value === '' ? undefined : value, z.coerce.number().finite().min(0).max(100000000).optional()),
  volume: z.number().finite().min(0).optional(),
  volumetricWeight: z.number().finite().min(0).optional(),
  chargedWeight: z.number().finite().min(0).optional(),
}).strict().superRefine((row, ctx) => {
  const dimensions = ['length', 'breadth', 'height'];
  if (dimensions.some(key => row[key] !== undefined)) {
    for (const key of dimensions) if (row[key] === undefined)
      ctx.addIssue({ code: 'custom', path: [key], message: 'Enter all three dimensions' });
  }
});
const goodsList = z.array(goodsSchema).min(1).max(100).superRefine((rows, ctx) => {
  if (rows.reduce((sum, row) => sum + row.quantity, 0) > 10000)
    ctx.addIssue({ code: 'custom', message: 'Maximum 10,000 packages per LR' });
  if (rows.reduce((sum, row) => sum + row.actualWeight, 0) > 100000)
    ctx.addIssue({ code: 'custom', message: 'Maximum total actual weight is 100,000 kg' });
});
const lrPrintFields = {
  goods: goodsList.optional(),
  volumetricWeight: lrAmount,
  consignorCode: lrPrintText,
  consignorAddress: lrPrintText,
  consignorAddress2: lrPrintText,
  consignorPincode: optional(z.string().regex(/^\d{6}$/, 'Enter a 6-digit pincode')),
  consignorGstin: lrGstin,
  consigneeAddress: lrPrintText,
  consigneeAddress2: lrPrintText,
  consigneeAddress3: lrPrintText,
  consigneePincode: optional(z.string().regex(/^\d{6}$/, 'Enter a 6-digit pincode')),
  consigneeGstin: lrGstin,
  bookingDate: lrPrintDate,
  bookingBranch: lrPrintText,
  from: lrPrintText,
  to: lrPrintText,
  deliveryAddress: lrPrintText,
  contactNo: optional(mobile),
  invoiceNo: lrPrintText,
  invoiceDate: lrPrintDate,
  eWayBillNo: lrPrintText,
  eWayBillDate: lrPrintDate,
  poStnNo: lrPrintText,
  customerReference: lrPrintText,
  packageNumber: lrPrintText,
  packageType: lrPrintText,
  actualWeight: lrPositiveAmount,
  chargedWeight: lrPositiveAmount,
  dimensions: lrPrintText,
  volume: lrPositiveAmount,
  declaredValue: lrAmount,
  shipperSignature: lrPrintText,
  remarks: lrPrintText,
  receiverNamePrint: lrPrintText,
  receiverMobilePrint: optional(mobile),
  receiverDateTime: lrPrintDate,
  receiverSignature: lrPrintText,
  paymentMode: optional(z.enum(['PAID', 'TO_PAY', 'CREDIT'])),
  riskType: optional(z.enum(['CARRIER_RISK', 'OWNER_RISK'])),
  insuranceType: optional(z.enum(['INSURED', 'NOT_INSURED'])),
  freightCharges: lrAmount,
  fuelCharges: lrAmount,
  handlingCharges: lrAmount,
  fodCodCharges: lrAmount,
  fodCharges: lrAmount,
  codCharges: lrAmount,
  rovCharges: lrAmount,
  docketCharges: lrAmount,
  gstRate: optional(z.coerce.number().finite().min(0).max(100)),
  gstAmount: lrAmount,
  totalAmount: lrAmount,
};
export const lrPrintFieldNames = Object.freeze(Object.keys(lrPrintFields));
export const lrCreateSchema = shipmentFields
  .extend({ lrNumber: manualLrNumber, customerId: objectId, originBranchId: objectId, destinationBranchId: objectId, ...lrPrintFields, from: text(2, 250), to: text(2, 250), goods: goodsList });
export const passwordSchema = z.object({
  currentPassword: password(8),
  newPassword: password(12),
});
