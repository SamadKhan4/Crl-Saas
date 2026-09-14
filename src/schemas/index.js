import { z } from 'zod';
const text = (min, max) => z.string().trim().min(min).max(max);
const password = (min) => z.string().min(min).max(128);
const optional = (schema) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema.optional());
const mobile = z.string().regex(/^\+?[1-9]\d{7,14}$/, 'Enter a valid mobile number');
const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Select a valid record');
export const loginSchema = z.object({ email: z.email(), password: password(8) });
export const customerSchema = z.object({
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
  weightKg: z.coerce.number().positive().max(100000),
  description: text(0, 500).optional(),
  expectedDeliveryDate: optional(
    z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Enter a valid date'),
  ),
});
export const shipmentSchema = shipmentFields
  .extend({ customerId: objectId, originBranchId: objectId, destinationBranchId: objectId })
  .refine((v) => v.originBranchId !== v.destinationBranchId, {
    path: ['destinationBranchId'],
    message: 'Destination must differ from origin',
  });
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
const lrPrintFields = {
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
  rovCharges: lrAmount,
  docketCharges: lrAmount,
  gstRate: optional(z.coerce.number().finite().min(0).max(100)),
  gstAmount: lrAmount,
  totalAmount: lrAmount,
};
export const lrPrintFieldNames = Object.freeze(Object.keys(lrPrintFields));
export const lrCreateSchema = shipmentFields
  .extend({ customerId: objectId, originBranchId: objectId, destinationBranchId: objectId, ...lrPrintFields })
  .refine((v) => v.originBranchId !== v.destinationBranchId, {
    path: ['destinationBranchId'],
    message: 'Destination must differ from origin',
  });
export const passwordSchema = z.object({
  currentPassword: password(8),
  newPassword: password(12),
});
