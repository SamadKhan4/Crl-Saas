import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation } from 'react-router-dom';
import { Plus, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { errorMessage, get } from '../api/client';
import {
  drsApi,
  invoicesApi,
  manifestsApi,
  quotationsApi,
  receiptsApi,
  stationeryApi,
  tripsApi,
  vendorsApi,
  registerApi,
} from '../api/services';
import { useAuth } from '../features/auth/AuthContext';
import { useDebounce, useList } from '../hooks/useList';
import { date, idOf, label } from '../lib/workflow';
import Lookup from '../components/forms/Lookup';
import SearchInput from '../components/forms/SearchInput';
import {
  DataTable,
  ErrorState,
  FormField,
  Loadingcrleleton,
  Modal,
  PageHeader,
  StatusBadge,
} from '../components/common/UI';

const today = () => new Date().toLocaleDateString('en-CA');
const money = (value) =>
  value == null
    ? '—'
    : Number(value).toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
const option = (values) => values.map((value) => [value, label(value)]);
const registerStatuses = option([
  'OPEN', 'PLANNED', 'IN_PROGRESS', 'COMPLETED', 'APPROVED', 'PAID', 'REJECTED', 'CANCELLED', 'INACTIVE',
]);
const registerConfig = ({ title, singular, description, fields, amount, count = false }) => ({
  title,
  singular,
  service: registerApi(singular),
  number: 'recordNumber',
  description,
  primary: (row) => row.title,
  secondary: (row) => [row.reference, row.origin && row.destination ? `${row.origin} → ${row.destination}` : '', row.vehicleNumber].filter(Boolean).join(' · ') || label(row.status),
  fields,
  defaults: { operationDate: today(), status: 'OPEN', quantity: 0, amount: 0, taxAmount: 0 },
  amount,
  count,
  edit: true,
  action: {
    label: 'Update status',
    path: 'status',
    fields: [['status', 'Status', 'select', registerStatuses], ['remarks', 'Remarks', 'textarea']],
  },
});

const configs = {
  vendors: {
    title: 'Vendor master',
    singular: 'vendor',
    service: vendorsApi,
    number: 'vendorCode',
    adminOnlyCreate: true,
    description: 'Maintain co-loaders, transport vendors, commercials and mapped vehicles.',
    primary: (row) => row.name,
    secondary: (row) => `${label(row.vendorType)} · ${row.mobile}`,
    fields: [
      [
        'vendorType',
        'Vendor type',
        'select',
        option(['TRANSPORTER', 'CO_LOADER', 'VEHICLE_OWNER', 'LAST_MILE']),
      ],
      ['name', 'Vendor / company name'],
      ['legalName', 'Legal name'],
      ['ownerName', 'Owner name'],
      ['contactPerson', 'Contact person'],
      ['mobile', 'Mobile', 'tel'],
      ['email', 'Email', 'email'],
      ['gstNumber', 'GSTIN'],
      ['panNumber', 'PAN'],
      ['gstType', 'GST type'],
      ['registrationType', 'Registration type'],
      ['address', 'Address'],
      ['city', 'City'],
      ['state', 'State'],
      ['pincode', 'Pincode'],
      [
        'commercial.rateBasis',
        'Rate basis',
        'select',
        option(['PER_KG', 'PER_BOX', 'PER_TRIP', 'FIXED']),
      ],
      ['commercial.rate', 'Base rate', 'number'],
      ['commercial.fuelSurchargePercent', 'Fuel surcharge %', 'number'],
      ['commercial.handlingCharge', 'Handling charge', 'number'],
      ['commercial.detentionPerDay', 'Detention / day', 'number'],
      ['commercial.creditDays', 'Credit days', 'number'],
      ['commercial.gstRate', 'GST %', 'number'],
      ['bank.bankName', 'Bank name'],
      ['bank.accountName', 'Account name'],
      ['bank.accountNumber', 'Account number'],
      ['bank.ifsc', 'IFSC'],
      ['bank.branch', 'Bank branch'],
      ['bank.upi', 'UPI'],
      ['servicesCsv', 'Services (FM, MM, LM, PTL, FTL...)'],
      ['document.type', 'Document type'],
      ['document.number', 'Document number'],
      ['document.expiresAt', 'Document expiry', 'date'],
      ['vehicle.vehicleNumber', 'Mapped vehicle number'],
      ['vehicle.vehicleType', 'Vehicle type'],
      ['vehicle.capacityKg', 'Vehicle capacity (kg)', 'number'],
      ['vehicle.driverName', 'Default driver'],
      ['vehicle.driverMobile', 'Driver mobile', 'tel'],
    ],
    defaults: {
      vendorType: 'TRANSPORTER',
      commercial: {
        rateBasis: 'PER_TRIP',
        rate: 0,
        fuelSurchargePercent: 0,
        handlingCharge: 0,
        detentionPerDay: 0,
        creditDays: 0,
        gstRate: 0,
      },
      vehicle: {},
    },
    edit: true,
  },
  manifests: {
    title: 'Manifestation',
    singular: 'manifest',
    service: manifestsApi,
    number: 'manifestNumber',
    description: 'Group LRs under a co-loader and keep its movement status current.',
    primary: (row) => row.destination,
    secondary: (row) => row.vendorId?.name || 'Co-loader',
    count: true,
    fields: [
      ['vendorId', 'Co-loader / transporter', 'lookup', 'vendors'],
      ['destination', 'Destination'],
      ['vehicleNumber', 'Vehicle number'],
      ['deliveryAgent', 'BA / delivery agent'],
      ['shipmentIds', 'LRs on manifest', 'shipments', ['BOOKED', 'IN_TRANSIT']],
      ['vendorReference', 'Vendor reference'],
      ['remarks', 'Remarks', 'textarea'],
    ],
    action: {
      label: 'Update status',
      path: 'status',
      fields: [
        [
          'coLoaderStatus',
          'Co-loader status',
          'select',
          option([
            'BOOKED',
            'PICKED_UP',
            'IN_TRANSIT',
            'AT_HUB',
            'OUT_FOR_DELIVERY',
            'DELIVERED',
            'EXCEPTION',
          ]),
        ],
        ['remarks', 'Remarks', 'textarea'],
      ],
    },
  },
  trips: {
    title: 'Trip planning & dispatch',
    singular: 'trip',
    service: tripsApi,
    number: 'tripNumber',
    description: 'Plan vehicle movement, assign LRs and control dispatch milestones.',
    primary: (row) => `${row.origin} → ${row.destination}`,
    secondary: (row) => `${row.vehicleNumber} · ${row.driverName}`,
    count: true,
    fields: [
      ['vendorId', 'Vehicle vendor', 'lookup', 'vendors'],
      ['vehicleNumber', 'Vehicle number'],
      ['driverName', 'Driver name'],
      ['driverMobile', 'Driver mobile', 'tel'],
      ['origin', 'Origin'],
      ['destination', 'Destination'],
      ['departureDate', 'Departure date', 'date'],
      ['expectedArrival', 'Expected arrival', 'date'],
      ['shipmentIds', 'LRs on trip', 'shipments', ['BOOKED']],
      ['freightAmount', 'Vendor freight', 'number'],
      ['advanceAmount', 'Advance paid', 'number'],
      ['startKm', 'Start KM', 'number'],
      ['endKm', 'End KM', 'number'],
      ['dieselAmount', 'Diesel expense', 'number'],
      ['tollAmount', 'Toll expense', 'number'],
      ['otherExpense', 'Other expense', 'number'],
      ['revenueAmount', 'Trip revenue', 'number'],
      ['remarks', 'Remarks', 'textarea'],
    ],
    defaults: { departureDate: today(), freightAmount: 0, advanceAmount: 0, startKm: 0, dieselAmount: 0, tollAmount: 0, otherExpense: 0, revenueAmount: 0 },
    action: {
      label: 'Move trip',
      path: 'status',
      fields: [
        [
          'status',
          'Next status',
          'select',
          option(['DISPATCHED', 'ARRIVED', 'CLOSED', 'CANCELLED']),
        ],
        ['remarks', 'Remarks', 'textarea'],
      ],
    },
  },
  drs: {
    title: 'Delivery run sheets',
    singular: 'DRS',
    service: drsApi,
    number: 'drsNumber',
    description: 'Assign last-mile runs, update Part B vehicle data and close only after POD.',
    primary: (row) => row.route,
    secondary: (row) => `${row.vehicleNumber} · ${row.driverName}`,
    count: true,
    fields: [
      ['vehicleNumber', 'Vehicle number'],
      ['driverName', 'Driver name'],
      ['driverMobile', 'Driver mobile', 'tel'],
      ['deliveryDate', 'Delivery date', 'date'],
      ['route', 'Delivery route'],
      [
        'shipmentIds',
        'LRs on DRS',
        'shipments',
        ['RECEIVED', 'LR_IMAGE_UPLOADED', 'LR_IMAGE_VERIFIED', 'COMPLETED'],
      ],
      ['partB.eWayBillNo', 'E-way bill number'],
      ['partB.vehicleNumber', 'Part B vehicle number'],
      ['remarks', 'Remarks', 'textarea'],
    ],
    defaults: { deliveryDate: today(), partB: {} },
    manage: true,
  },
  invoices: {
    title: 'Credit client billing',
    singular: 'invoice',
    service: invoicesApi,
    number: 'invoiceNumber',
    description: 'Create controlled GST invoices from delivered, unbilled credit-client LRs.',
    primary: (row) => row.customerId?.name || 'Customer',
    secondary: (row) => money(row.totalAmount),
    count: true,
    fields: [
      ['customerId', 'Credit customer', 'lookup', 'customers'],
      ['shipmentIds', 'Delivered LRs', 'shipments', ['COMPLETED', 'CLOSED']],
      ['periodFrom', 'Billing period from', 'date'],
      ['periodTo', 'Billing period to', 'date'],
      ['issueDate', 'Invoice date', 'date'],
      ['dueDate', 'Due date', 'date'],
      ['gstRate', 'GST %', 'number'],
      ['notes', 'Notes', 'textarea'],
    ],
    defaults: { issueDate: today(), gstRate: 0 },
    action: {
      label: 'Invoice action',
      path: 'status',
      fields: [
        ['status', 'Action', 'select', option(['ISSUED', 'CANCELLED'])],
        ['notes', 'Reason / notes', 'textarea'],
      ],
    },
    amount: 'balanceAmount',
  },
  'money-receipts': {
    title: 'Money receipts',
    singular: 'receipt',
    service: receiptsApi,
    number: 'receiptNumber',
    description: 'Record customer collections with payment reference and invoice allocation.',
    primary: (row) => row.receivedFrom,
    secondary: (row) => row.customerId?.name || row.paymentMode,
    fields: [
      ['customerId', 'Customer', 'lookup', 'customers'],
      ['receivedFrom', 'Received from'],
      ['amount', 'Amount received', 'number'],
      ['paymentMode', 'Payment mode', 'select', option(['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE'])],
      ['transactionReference', 'Transaction / cheque reference'],
      ['receiptDate', 'Receipt date', 'date'],
      ['allocation.invoiceId', 'Allocate to invoice', 'lookup', 'invoices'],
      ['allocation.amount', 'Allocation amount', 'number'],
      ['remarks', 'Remarks', 'textarea'],
    ],
    defaults: { paymentMode: 'CASH', receiptDate: today(), allocation: {} },
    amount: 'amount',
  },
  quotations: {
    title: 'Quotations',
    singular: 'quotation',
    service: quotationsApi,
    number: 'quotationNumber',
    description: 'Handle website enquiries and issue a consistent transport quotation.',
    primary: (row) => row.companyName || row.leadName,
    secondary: (row) => `${row.origin} → ${row.destination}`,
    fields: [
      ['customerId', 'Existing customer', 'lookup', 'customers'],
      ['leadName', 'Contact name'],
      ['companyName', 'Company'],
      ['billingAddress', 'Billing address', 'textarea'],
      ['mobile', 'Mobile', 'tel'],
      ['email', 'Email', 'email'],
      ['paymentTerms', 'Payment terms'],
      ['validityDays', 'Validity (days)', 'number'],
      ['serviceType', 'Service type', 'select', option(['FTL', 'PTL', 'PACKERS_MOVERS'])],
      ['origin', 'Origin'],
      ['destination', 'Destination'],
      ['goodsDescription', 'Goods description', 'textarea'],
      ['packageCount', 'Packages', 'number'],
      ['weightKg', 'Weight (kg)', 'number'],
      ['estimatedFreight', 'Estimated freight', 'number'],
      ['gstRate', 'GST %', 'number'],
      ['validUntil', 'Valid until', 'date'],
      ['rate1.origin', 'Rate 1 - origin'],
      ['rate1.destination', 'Rate 1 - destination'],
      ['rate1.mode', 'Rate 1 - mode', 'select', option(['FTL', 'PTL', 'PACKERS_MOVERS'])],
      ['rate1.rateBasis', 'Rate 1 - basis', 'select', option(['PER_TRIP', 'PER_KG', 'PER_JOB'])],
      ['rate1.rate', 'Rate 1 - amount', 'number'],
      ['rate2.origin', 'Rate 2 - origin'],
      ['rate2.destination', 'Rate 2 - destination'],
      ['rate2.mode', 'Rate 2 - mode', 'select', option(['FTL', 'PTL', 'PACKERS_MOVERS'])],
      ['rate2.rateBasis', 'Rate 2 - basis', 'select', option(['PER_TRIP', 'PER_KG', 'PER_JOB'])],
      ['rate2.rate', 'Rate 2 - amount', 'number'],
      ['rate3.origin', 'Rate 3 - origin'],
      ['rate3.destination', 'Rate 3 - destination'],
      ['rate3.mode', 'Rate 3 - mode', 'select', option(['FTL', 'PTL', 'PACKERS_MOVERS'])],
      ['rate3.rateBasis', 'Rate 3 - basis', 'select', option(['PER_TRIP', 'PER_KG', 'PER_JOB'])],
      ['rate3.rate', 'Rate 3 - amount', 'number'],
      ['accessorialCharges.docketCharges', 'Docket / LR charges'],
      ['accessorialCharges.rovOwnerRisk', 'ROV / owner risk'],
      ['accessorialCharges.fod', 'FOD charges'],
      ['accessorialCharges.codHandling', 'COD handling'],
      ['accessorialCharges.pickupCharges', 'Pickup charges'],
      ['accessorialCharges.odaRemoteArea', 'ODA / remote area'],
      ['accessorialCharges.hamali', 'Hamali / loading / unloading'],
      ['accessorialCharges.reattemptDelivery', 'Re-attempt delivery'],
      ['accessorialCharges.appointmentDelivery', 'Appointment delivery'],
      ['accessorialCharges.detention', 'Detention'],
      ['accessorialCharges.storage', 'Storage / godown'],
      ['accessorialCharges.specialHandling', 'Special / fragile handling'],
      ['accessorialCharges.insurance', 'Insurance'],
      ['accessorialCharges.gst', 'GST commercial term'],
      ['notes', 'Commercial notes', 'textarea'],
    ],
    defaults: {
      packageCount: 1,
      estimatedFreight: 0,
      gstRate: 0,
      validityDays: 30,
      paymentTerms: '15 / 30 Days',
      serviceType: 'PTL',
      rate1: { mode: 'PTL', rateBasis: 'PER_KG' },
      rate2: { mode: 'PTL', rateBasis: 'PER_KG' },
      rate3: { mode: 'PACKERS_MOVERS', rateBasis: 'PER_JOB' },
      accessorialCharges: {
        docketCharges: 'Rs.25 - Rs.50 per LR',
        rovOwnerRisk: '0.10% of declared value (Min. Rs.25)',
        specialHandling: 'As mutually agreed',
        insurance: "Consignor's responsibility / Actual",
        gst: 'As applicable',
      },
    },
    amount: 'totalAmount',
    action: {
      label: 'Update quote',
      path: 'status',
      fields: [
        ['status', 'Status', 'select', option(['QUOTED', 'ACCEPTED', 'REJECTED', 'EXPIRED'])],
        ['estimatedFreight', 'Estimated freight', 'number'],
        ['gstRate', 'GST %', 'number'],
        ['validUntil', 'Valid until', 'date'],
        ['notes', 'Notes', 'textarea'],
      ],
    },
  },
  stationery: {
    title: 'Stationery register',
    singular: 'transaction',
    service: stationeryApi,
    number: 'transactionNumber',
    description:
      'Receive stock and issue controlled stationery to vendors, branches or field executives.',
    primary: (row) => label(row.itemType),
    secondary: (row) => `${label(row.transactionType)} · Qty ${row.quantity}`,
    fields: [
      [
        'itemType',
        'Stationery item',
        'select',
        option(['LR_BOOK', 'POD_BOOK', 'MONEY_RECEIPT_BOOK', 'LABEL', 'OTHER']),
      ],
      ['transactionType', 'Transaction', 'select', option(['RECEIVE', 'ISSUE'])],
      ['quantity', 'Quantity', 'number'],
      ['serialFrom', 'Serial from'],
      ['serialTo', 'Serial to'],
      ['issuedToType', 'Issue to', 'select', option(['VENDOR', 'FE', 'BRANCH'])],
      ['vendorId', 'Vendor', 'lookup', 'vendors'],
      ['issuedToName', 'Field executive / recipient'],
      ['transactionDate', 'Date', 'date'],
      ['remarks', 'Remarks', 'textarea'],
    ],
    defaults: {
      itemType: 'LR_BOOK',
      transactionType: 'RECEIVE',
      quantity: 1,
      transactionDate: today(),
    },
  },
  pickups: registerConfig({
    title: 'Pickup / First Mile', singular: 'pickups', description: 'Plan pickups and first-mile handover against selected LRs.', count: true,
    fields: [['title', 'Pickup run / party'], ['operationDate', 'Pickup date', 'date'], ['origin', 'Pickup location'], ['destination', 'Receiving hub'], ['vehicleNumber', 'Vehicle number'], ['driverName', 'Driver / FE name'], ['driverMobile', 'Driver mobile', 'tel'], ['shipmentIds', 'LRs for pickup', 'shipments', ['BOOKED']], ['reference', 'Pickup reference'], ['remarks', 'Remarks', 'textarea']],
  }),
  'ptl-operations': registerConfig({
    title: 'PTL Operations', singular: 'ptl-operations', description: 'Control part-truck-load consolidation and movement.', count: true,
    fields: [['title', 'PTL load / lane'], ['operationDate', 'Operation date', 'date'], ['origin', 'Origin hub'], ['destination', 'Destination hub'], ['vehicleNumber', 'Vehicle number'], ['vendorId', 'Co-loader / vendor', 'lookup', 'vendors'], ['shipmentIds', 'PTL LRs', 'shipments', ['BOOKED', 'IN_TRANSIT']], ['quantity', 'Packages', 'number'], ['amount', 'Operational cost', 'number'], ['remarks', 'Remarks', 'textarea']],
  }),
  'ftl-operations': registerConfig({
    title: 'FTL Operations', singular: 'ftl-operations', description: 'Control dedicated full-truck-load movements.', count: true,
    fields: [['title', 'FTL load / customer'], ['operationDate', 'Dispatch date', 'date'], ['origin', 'Origin'], ['destination', 'Destination'], ['vehicleNumber', 'Vehicle number'], ['driverName', 'Driver name'], ['driverMobile', 'Driver mobile', 'tel'], ['vendorId', 'Vehicle vendor', 'lookup', 'vendors'], ['shipmentIds', 'FTL LRs', 'shipments', ['BOOKED', 'IN_TRANSIT']], ['amount', 'Trip cost', 'number'], ['remarks', 'Remarks', 'textarea']],
  }),
  hubs: registerConfig({
    title: 'Hub Management', singular: 'hubs', description: 'Record inward, sorting, staging and outward hub activity.', count: true,
    fields: [['title', 'Hub activity'], ['operationDate', 'Activity date', 'date'], ['reference', 'Hub / bay reference'], ['origin', 'Received from'], ['destination', 'Forward to'], ['shipmentIds', 'Handled LRs', 'shipments', ['IN_TRANSIT', 'RECEIVED']], ['quantity', 'Package quantity', 'number'], ['description', 'Activity details', 'textarea'], ['remarks', 'Exception / remarks', 'textarea']],
  }),
  handling: registerConfig({
    title: 'Loading / Unloading', singular: 'handling', description: 'Record loading, unloading, labour and package handling.', count: true,
    fields: [['title', 'Handling activity'], ['operationDate', 'Activity date', 'date'], ['reference', 'Dock / batch reference'], ['vehicleNumber', 'Vehicle number'], ['shipmentIds', 'Handled LRs', 'shipments', ['BOOKED', 'IN_TRANSIT', 'RECEIVED']], ['quantity', 'Packages handled', 'number'], ['amount', 'Labour / hamali amount', 'number'], ['description', 'Handling details', 'textarea'], ['remarks', 'Remarks', 'textarea']],
  }),
  fleet: registerConfig({
    title: 'Vehicle / Fleet', singular: 'fleet', description: 'Maintain owned and attached vehicle records and compliance.',
    fields: [['title', 'Vehicle type / owner'], ['vehicleNumber', 'Vehicle number'], ['operationDate', 'Registration / start date', 'date'], ['dueDate', 'Insurance / permit expiry', 'date'], ['vendorId', 'Mapped vendor', 'lookup', 'vendors'], ['reference', 'RC / permit reference'], ['quantity', 'Capacity (kg)', 'number'], ['description', 'Insurance / fitness details', 'textarea'], ['remarks', 'Remarks', 'textarea']],
  }),
  drivers: registerConfig({
    title: 'Driver Master', singular: 'drivers', description: 'Maintain driver identity, licence and validity details.',
    fields: [['title', 'Driver name'], ['driverMobile', 'Mobile', 'tel'], ['operationDate', 'Joining date', 'date'], ['dueDate', 'Licence expiry', 'date'], ['documentNumber', 'Driving licence number'], ['vehicleNumber', 'Default vehicle'], ['vendorId', 'Vendor / owner', 'lookup', 'vendors'], ['description', 'Address / emergency contact', 'textarea'], ['remarks', 'Remarks', 'textarea']],
  }),
  'vendor-settlements': registerConfig({
    title: 'Vendor Billing / Settlement', singular: 'vendor-settlements', description: 'Record vendor bills, deductions, approvals and payments.', amount: 'amount',
    fields: [['title', 'Bill / settlement title'], ['vendorId', 'Vendor', 'lookup', 'vendors'], ['operationDate', 'Bill date', 'date'], ['dueDate', 'Payment due date', 'date'], ['documentNumber', 'Vendor invoice number'], ['reference', 'Trip / manifest reference'], ['metadata.baseAmount', 'Base vendor freight', 'number'], ['metadata.detention', 'Detention', 'number'], ['metadata.loading', 'Loading / unloading', 'number'], ['metadata.otherCharge', 'Other charge', 'number'], ['metadata.tds', 'TDS deduction', 'number'], ['metadata.advance', 'Advance paid', 'number'], ['description', 'Deductions / details', 'textarea'], ['remarks', 'Remarks', 'textarea']],
  }),
  'eway-gst': registerConfig({
    title: 'E-Way Bill / GST Register', singular: 'eway-gst', description: 'Track statutory document validity, vehicle and tax details.',
    fields: [['title', 'Consignor / document'], ['metadata.operation', 'Operation', 'select', option(['GENERATE', 'UPDATE_VEHICLE', 'EXTEND', 'CANCEL', 'CHECK_STATUS'])], ['documentNumber', 'E-Way bill / GST document number'], ['operationDate', 'Document date', 'date'], ['dueDate', 'Valid until', 'date'], ['customerId', 'Customer', 'lookup', 'customers'], ['shipmentIds', 'Linked LRs', 'shipments', ['BOOKED', 'IN_TRANSIT', 'RECEIVED']], ['reference', 'Invoice reference'], ['vehicleNumber', 'Part B vehicle number'], ['amount', 'Taxable value', 'number'], ['taxAmount', 'GST amount', 'number'], ['metadata.validityAlertHours', 'Alert before expiry (hours)', 'number'], ['remarks', 'Remarks', 'textarea']],
  }),
  accounting: registerConfig({
    title: 'Accounting Register', singular: 'accounting', description: 'Record branch expenses, income, advances and adjustments.', amount: 'amount',
    fields: [['title', 'Ledger / transaction'], ['operationDate', 'Transaction date', 'date'], ['reference', 'Voucher / bank reference'], ['customerId', 'Customer', 'lookup', 'customers'], ['vendorId', 'Vendor', 'lookup', 'vendors'], ['amount', 'Amount', 'number'], ['taxAmount', 'Tax amount', 'number'], ['description', 'Narration', 'textarea'], ['remarks', 'Remarks', 'textarea']],
  }),
  hr: registerConfig({
    title: 'Employee / HR Register', singular: 'hr', description: 'Maintain employee HR events, attendance and documents.',
    fields: [['title', 'Employee / HR event'], ['userId', 'System employee', 'lookup', 'users'], ['operationDate', 'Effective date', 'date'], ['dueDate', 'Review / expiry date', 'date'], ['reference', 'Employee / document reference'], ['quantity', 'Days / units', 'number'], ['amount', 'Amount / advance', 'number'], ['description', 'HR details', 'textarea'], ['remarks', 'Remarks', 'textarea']],
  }),
  claims: registerConfig({
    title: 'Claims / Damage', singular: 'claims', description: 'Register shortage, damage and claim settlement cases.', amount: 'amount', count: true,
    fields: [['title', 'Claim title'], ['operationDate', 'Incident date', 'date'], ['shipmentIds', 'Affected LRs', 'shipments', ['IN_TRANSIT', 'RECEIVED', 'COMPLETED', 'CLOSED']], ['customerId', 'Customer', 'lookup', 'customers'], ['vendorId', 'Responsible vendor', 'lookup', 'vendors'], ['reference', 'Claim reference'], ['documentNumber', 'Box barcode'], ['metadata.damageType', 'Damage / loss type'], ['metadata.responsibleParty', 'Responsible party'], ['quantity', 'Damaged / short packages', 'number'], ['amount', 'Claim amount', 'number'], ['metadata.photoUrls', 'Photo URLs / references', 'textarea'], ['description', 'Investigation details', 'textarea'], ['remarks', 'Approval / settlement remarks', 'textarea']],
  }),
  notifications: registerConfig({
    title: 'Notifications', singular: 'notifications', description: 'Create and track operational reminders and alerts.',
    fields: [['title', 'Notification subject'], ['operationDate', 'Schedule date', 'date'], ['dueDate', 'Expiry date', 'date'], ['userId', 'Assigned employee', 'lookup', 'users'], ['customerId', 'Related customer', 'lookup', 'customers'], ['reference', 'LR / task reference'], ['description', 'Message', 'textarea'], ['remarks', 'Internal notes', 'textarea']],
  }),
  'system-settings': registerConfig({
    title: 'Operational Settings', singular: 'system-settings', description: 'Maintain branch-level operational rules and controlled values.',
    fields: [['title', 'Setting name'], ['reference', 'Setting key'], ['operationDate', 'Effective date', 'date'], ['description', 'Setting value / rule', 'textarea'], ['remarks', 'Change reason', 'textarea']],
  }),
};

const valueAt = (source, path) => path.split('.').reduce((value, key) => value?.[key], source);
const setAt = (source, path, value) => {
  const keys = path.split('.');
  const copy = structuredClone(source);
  let target = copy;
  keys.slice(0, -1).forEach((key) => {
    target[key] = target[key] || {};
    target = target[key];
  });
  target[keys.at(-1)] = value;
  return copy;
};
const clean = (value) => {
  if (Array.isArray(value)) return value.map(clean);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).flatMap(([key, item]) => {
        const normalized = clean(item);
        return normalized === '' ||
          normalized == null ||
          (typeof normalized === 'object' &&
            !Array.isArray(normalized) &&
            !Object.keys(normalized).length)
          ? []
          : [[key, normalized]];
      }),
    );
  return value;
};

function prepare(resource, values) {
  const payload = clean(values);
  if (resource === 'vendors') {
    return {
      vendorType: payload.vendorType,
      name: payload.name,
      legalName: payload.legalName,
      ownerName: payload.ownerName,
      contactPerson: payload.contactPerson,
      mobile: payload.mobile,
      email: payload.email,
      address: payload.address,
      city: payload.city,
      state: payload.state,
      pincode: payload.pincode,
      gstNumber: payload.gstNumber,
      panNumber: payload.panNumber,
      gstType: payload.gstType,
      registrationType: payload.registrationType,
      bank: payload.bank,
      services: String(payload.servicesCsv || '').split(',').map((value) => value.trim().toUpperCase()).filter(Boolean),
      documents: payload.document?.type ? [{ ...payload.document, verified: false }] : [],
      commercial: payload.commercial,
      vehicles: payload.vehicle?.vehicleNumber ? [{ ...payload.vehicle, status: 'ACTIVE' }] : [],
    };
  }
  if (resource === 'drs')
    payload.partB = payload.partB?.eWayBillNo
      ? [{ ...payload.partB, vehicleNumber: payload.partB.vehicleNumber || payload.vehicleNumber }]
      : [];
  if (resource === 'money-receipts') {
    payload.allocations = payload.allocation?.invoiceId
      ? [
          {
            invoiceId: payload.allocation.invoiceId,
            amount: payload.allocation.amount || payload.amount,
          },
        ]
      : [];
    payload.shipmentIds = [];
    delete payload.allocation;
  }
  if (resource === 'quotations') {
    payload.transportationRates = [payload.rate1, payload.rate2, payload.rate3]
      .filter((row) => row?.origin && row?.destination && row?.mode && row?.rateBasis && row?.rate !== undefined);
    delete payload.rate1;
    delete payload.rate2;
    delete payload.rate3;
  }
  return payload;
}

function ShipmentPicker({ value = [], onChange, statuses, customerId }) {
  const [search, setSearch] = useState('');
  const term = useDebounce(search);
  const query = useQuery({
    queryKey: ['shipments', 'tms-picker', term, customerId],
    queryFn: () => get('/shipments', { search: term, limit: 100, ...(customerId && { customerId }) }),
  });
  const rows = (query.data?.data || []).filter((row) => statuses.includes(row.currentStatus));
  return (
    <div className="field tms-span-2">
      <label>Search and select LRs</label>
      <input
        value={search}
        maxLength={100}
        placeholder="LR number, customer or route"
        onChange={(event) => setSearch(event.target.value)}
      />
      {query.isPending ? (
        <small>Loading eligible LRs…</small>
      ) : query.isError ? (
        <small className="field-error">{errorMessage(query.error)}</small>
      ) : (
        <div className="tms-checklist">
          {rows.length ? (
            rows.map((row) => (
              <label key={idOf(row)}>
                <input
                  type="checkbox"
                  checked={value.includes(idOf(row))}
                  onChange={(event) =>
                    onChange(
                      event.target.checked
                        ? [...value, idOf(row)]
                        : value.filter((item) => item !== idOf(row)),
                    )
                  }
                />
                <span>
                  <b>{row.lrNumber}</b>
                  <small>
                    {row.senderName} → {row.receiverName} · {label(row.currentStatus)}
                  </small>
                </span>
              </label>
            ))
          ) : (
            <small>No eligible LRs found.</small>
          )}
        </div>
      )}
      <small>{value.length} LR selected</small>
    </div>
  );
}

function DynamicFields({ resource, fields, values, setValues }) {
  return fields.map(([name, caption, type = 'text', meta]) => {
    const value = valueAt(values, name) ?? '';
    const change = (next) => setValues((current) => {
      const updated = setAt(current, name, next);
      if (resource === 'invoices' && name === 'customerId' && current.customerId !== next)
        updated.shipmentIds = [];
      return updated;
    });
    if (type === 'lookup')
      return (
        <Lookup
          key={name}
          resource={meta}
          label={caption}
          value={value}
          onChange={change}
          activeOnly={meta !== 'invoices'}
          customerType={resource === 'invoices' && name === 'customerId' ? 'CREDIT' : undefined}
        />
      );
    if (type === 'shipments')
      return <ShipmentPicker key={name} value={value || []} onChange={change} statuses={meta} customerId={resource === 'invoices' ? values.customerId : undefined} />;
    if (type === 'select')
      return (
        <div className="field" key={name}>
          <label htmlFor={name}>{caption}</label>
          <select id={name} value={value} onChange={(event) => change(event.target.value)}>
            <option value="">Select {caption.toLowerCase()}</option>
            {meta.map(([key, text]) => (
              <option value={key} key={key}>
                {text}
              </option>
            ))}
          </select>
        </div>
      );
    if (type === 'textarea')
      return (
        <div className="field tms-span-2" key={name}>
          <label htmlFor={name}>{caption}</label>
          <textarea
            id={name}
            value={value}
            maxLength={1000}
            onChange={(event) => change(event.target.value)}
          />
        </div>
      );
    return (
      <FormField
        key={name}
        name={name}
        label={caption}
        type={type}
        value={value}
        min={type === 'number' ? 0 : undefined}
        step={type === 'number' ? 'any' : undefined}
        onChange={(event) => change(event.target.value)}
      />
    );
  });
}

function RecordEditor({ resource, config, record, onClose }) {
  const { user } = useAuth();
  const [values, setValues] = useState(() =>
    record
      ? {
          ...record,
          vehicle: record.vehicles?.[0] || {},
          servicesCsv: record.services?.join(', ') || '',
          document: record.documents?.[0] || {},
        }
      : structuredClone(config.defaults || {}),
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const cache = useQueryClient();
  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const payload = prepare(resource, values);
      if (record) await config.service.update(idOf(record), payload);
      else await config.service.create(payload);
      cache.invalidateQueries({ queryKey: [resource] });
      toast.success(`${config.title} saved`);
      onClose();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={`${record ? 'Edit' : 'Add'} ${config.singular}`}
      onClose={() => !busy && onClose()}
    >
      <form onSubmit={save}>
        <div className="form-grid">
          {user.role === 'ADMIN' && resource !== 'vendors' && (
            <Lookup
              resource="branches"
              branchOptions
              label="Operating branch"
              value={values.branchId || ''}
              onChange={(value) => setValues((current) => ({ ...current, branchId: value }))}
            />
          )}
          <DynamicFields resource={resource} fields={config.fields} values={values} setValues={setValues} />
        </div>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-footer">
          <button type="button" className="btn secondary" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button className="btn" disabled={busy}>
            {busy ? 'Saving…' : `Save ${config.singular}`}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function StatusEditor({ resource, config, record, onClose }) {
  const [values, setValues] = useState({});
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const cache = useQueryClient();
  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await config.service.status(idOf(record), clean(values));
      cache.invalidateQueries({ queryKey: [resource] });
      toast.success('Status updated');
      onClose();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={`${config.action.label} · ${record[config.number]}`}
      onClose={() => !busy && onClose()}
    >
      <form onSubmit={save}>
        <div className="form-grid">
          <DynamicFields resource={resource} fields={config.action.fields} values={values} setValues={setValues} />
        </div>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-footer">
          <button type="button" className="btn secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" disabled={busy}>
            {busy ? 'Updating…' : 'Confirm update'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function TmsModulePage() {
  const resource = useLocation().pathname.replace(/\/+$/, '').split('/').at(-1);
  const config = configs[resource];
  const { user } = useAuth();
  const { query, filters, update, clear, sort } = useList(resource, config.service);
  const [editor, setEditor] = useState(null),
    [action, setAction] = useState(null);
  const base = `/${user.role.toLowerCase()}`;
  const columns = useMemo(
    () => [
      {
        key: 'number',
        label: 'Number',
        sort: config.number,
        render: (row) => <strong>{row[config.number]}</strong>,
      },
      {
        key: 'record',
        label: config.singular,
        render: (row) => (
          <div>
            <strong>{config.primary(row)}</strong>
            <small className="tms-table-subtitle">{config.secondary(row)}</small>
          </div>
        ),
      },
      ...(config.count
        ? [{ key: 'shipmentCount', label: 'LRs', render: (row) => row.shipmentIds?.length || 0 }]
        : []),
      ...(config.amount
        ? [{ key: 'amount', label: 'Amount', render: (row) => money(row[config.amount]) }]
        : []),
      {
        key: 'status',
        label: 'Status',
        render: (row) => (
          <StatusBadge status={resource === 'manifests' ? row.coLoaderStatus : row.status} />
        ),
      },
      {
        key: 'createdAt',
        label: 'Created',
        sort: 'createdAt',
        render: (row) => date(row.createdAt),
      },
      {
        key: 'actions',
        label: 'Actions',
        render: (row) => (
          <div className="row-actions">
            {['manifests', 'quotations', 'invoices'].includes(resource) && (
              <Link className="text-btn" to={`${base}/${resource}/${idOf(row)}`}>
                View / Print
              </Link>
            )}
            {config.manage && user.role !== 'EMPLOYEE' && (
              <Link className="text-btn" to={`${base}/drs/${idOf(row)}`}>
                Manage POD
              </Link>
            )}
            {config.edit && user.role === 'ADMIN' && (
              <button className="text-btn" onClick={() => setEditor(row)}>
                Edit
              </button>
            )}
            {config.action && user.role !== 'EMPLOYEE' && (
              <button className="text-btn" onClick={() => setAction(row)}>
                {config.action.label}
              </button>
            )}
          </div>
        ),
      },
    ],
    [base, config, resource, user.role],
  );
  const canCreate = !config.adminOnlyCreate || user.role === 'ADMIN';
  return (
    <>
      <PageHeader title={config.title} description={config.description}>
        {canCreate && (
          <button className="btn" onClick={() => setEditor({})}>
            <Plus size={17} /> Add {config.singular}
          </button>
        )}
      </PageHeader>
      <section className="panel">
        <div className="filter-bar">
          <SearchInput value={filters.search || ''} onChange={(value) => update('search', value)} />
          <select
            aria-label="Status"
            value={filters.status || ''}
            onChange={(event) => update('status', event.target.value)}
          >
            <option value="">All statuses</option>
          </select>
          <button className="text-btn" onClick={clear}>
            <RefreshCw size={14} /> Clear
          </button>
        </div>
        {query.isPending ? (
          <Loadingcrleleton />
        ) : query.isError ? (
          <ErrorState error={errorMessage(query.error)} retry={query.refetch} />
        ) : (
          <DataTable
            rows={query.data.data}
            columns={columns}
            pagination={query.data.pagination}
            onPage={(page) => update('page', page)}
            onSort={sort}
          />
        )}
      </section>
      {editor && (
        <RecordEditor
          resource={resource}
          config={config}
          record={idOf(editor) ? editor : null}
          onClose={() => setEditor(null)}
        />
      )}
      {action && (
        <StatusEditor
          resource={resource}
          config={config}
          record={action}
          onClose={() => setAction(null)}
        />
      )}
    </>
  );
}
