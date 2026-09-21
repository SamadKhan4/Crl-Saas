import { z } from 'zod';
import { serviceLocationNames } from '../data/serviceLocations';
const text = (min, max) => z.string().trim().min(min).max(max);
const password = (min) => z.string().min(min).max(128);
const optional = (schema) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema.optional());
const mobile = z.string().regex(/^\+?[1-9]\d{7,14}$/, 'Enter a valid mobile number');
const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Select a valid record');
export const loginSchema = z.object({ email: z.email(), password: password(8) });
const creditRateSchema = z.object({
  location: z.enum(serviceLocationNames),
  transitDays: z.coerce.number().int().min(1).max(30),
  ratePerKg: z.coerce.number().finite().positive('Enter a rate greater than zero').max(1000000),
});
const customerCharge = z.coerce.number().finite().min(0).max(100000000).default(0);
const customerPercent = z.coerce.number().finite().min(0).max(100).default(0);
const creditChargesSchema = z.object({
  fuelRatePercent: customerPercent,
  handlingCharges: customerCharge,
  fodCharges: customerCharge,
  codCharges: customerCharge,
  rovRatePercent: customerPercent,
  docketCharges: customerCharge,
  gstRate: customerPercent,
}).default({});
export const customerSchema = z.object({
  customerType: z.enum(['CREDIT', 'TO_PAY_PAID']),
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
  legalName: text(0, 150).optional(),
  tradeName: text(0, 150).optional(),
  industry: text(0, 100).optional(),
  panNumber: text(0, 10).optional(),
  gstType: text(0, 40).optional(),
  billingState: text(0, 100).optional(),
  billingAddress: text(0, 500).optional(),
  pickupLocations: z.array(z.object({ code: text(1, 40), name: text(2, 150), address: text(0, 500).optional(), city: text(0, 100).optional(), state: text(0, 100).optional(), pincode: optional(z.string().regex(/^\d{6}$/)), contactPerson: text(0, 120).optional(), mobile: optional(mobile) })).default([]),
  deliveryLocations: z.array(z.object({ code: text(1, 40), name: text(2, 150), address: text(0, 500).optional(), city: text(0, 100).optional(), state: text(0, 100).optional(), pincode: optional(z.string().regex(/^\d{6}$/)), contactPerson: text(0, 120).optional(), mobile: optional(mobile) })).default([]),
  services: z.array(z.string()).default([]),
  billing: z.object({ cycle: text(0, 60).optional(), paymentTerms: text(0, 120).optional(), creditLimit: customerCharge, creditDays: z.coerce.number().int().min(0).max(365).default(0), invoiceMode: z.enum(['SINGLE_LR', 'CONSOLIDATED', 'BOTH']).optional(), gstRate: customerPercent, tdsRate: customerPercent, billingEmail: optional(z.email()) }).optional(),
  contacts: z.array(z.object({ department: z.string(), name: text(2, 120), mobile: optional(mobile), email: optional(z.email()) })).default([]),
  documents: z.array(z.object({ type: text(2, 60), number: text(0, 120).optional(), fileUrl: optional(z.url()), expiresAt: optional(z.string()) })).default([]),
  creditRateCard: z.array(creditRateSchema).max(serviceLocationNames.length).default([]),
  creditCharges: creditChargesSchema,
}).superRefine((customer, ctx) => {
  if (customer.customerType === 'CREDIT' && !customer.creditRateCard.length)
    ctx.addIssue({ code: 'custom', path: ['creditRateCard'], message: 'Select at least one location and enter its rate' });
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
  vendorId: objectId.optional(),
  permissions: z.array(z.object({ module: z.string(), actions: z.array(z.string()) })).optional(),
});
const salaryAmount = z.coerce.number().finite().min(0).max(100000000);
export const payslipSchema = z.object({
  employeeId: objectId,
  salaryMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Select salary month'),
  designation: text(0, 120).optional(),
  department: text(0, 120).optional(),
  paidDays: z.coerce.number().min(0).max(31),
  earnings: z.object({ basic: salaryAmount, hra: salaryAmount, conveyance: salaryAmount, allowance: salaryAmount, bonus: salaryAmount, other: salaryAmount }),
  deductions: z.object({ pf: salaryAmount, esi: salaryAmount, professionalTax: salaryAmount, tds: salaryAmount, advance: salaryAmount, other: salaryAmount }),
  paymentDate: optional(z.string()),
  paymentReference: text(0, 150).optional(),
  notes: text(0, 500).optional(),
});
export const employeeOnboardingSchema = z.object({
  name: text(2, 100),
  email: z.email(),
  mobile,
  alternateMobile: optional(mobile),
  dateOfBirth: optional(z.string()),
  joiningDate: z.string().min(1, 'Select joining date'),
  designation: text(2, 120),
  department: text(2, 120),
  branchId: objectId,
  address: text(0, 500).optional(),
  city: text(0, 100).optional(),
  state: text(0, 100).optional(),
  pincode: optional(z.string().regex(/^\d{6}$/, 'Enter a 6-digit pincode')),
  emergencyContactName: text(0, 120).optional(),
  emergencyContactMobile: optional(mobile),
  panNumber: optional(z.string().trim().toUpperCase().regex(/^[A-Z]{5}\d{4}[A-Z]$/, 'Enter a valid PAN')),
  aadhaarLast4: optional(z.string().regex(/^\d{4}$/, 'Enter only last 4 Aadhaar digits')),
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
  freightBasis: optional(z.enum(['PER_KG', 'PER_BOX', 'FIXED'])),
  freightRate: lrAmount,
  fuelRatePercent: optional(z.coerce.number().finite().min(0).max(100)),
  rovRatePercent: optional(z.coerce.number().finite().min(0).max(100)),
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
