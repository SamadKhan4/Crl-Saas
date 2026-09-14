export const demoUsers = [
  { id: 'user-admin', name: 'Demo Administrator', email: 'admin@crl-demo.com', password: 'Admin@123', role: 'ADMIN', status: 'ACTIVE', employeeCode: 'ADM-001', branchId: null },
  { id: 'user-manager', name: 'Demo Manager', email: 'manager@crl-demo.com', password: 'Manager@123', role: 'MANAGER', status: 'ACTIVE', employeeCode: 'MGR-001', branchId: 'branch-nagpur' },
  { id: 'user-employee', name: 'Demo Employee', email: 'employee@crl-demo.com', password: 'Employee@123', role: 'EMPLOYEE', status: 'ACTIVE', employeeCode: 'EMP-001', branchId: 'branch-nagpur' },
];

export const demoBranches = [
  { id: 'branch-nagpur', branchCode: 'NGP', name: 'Nagpur Hub', city: 'Nagpur', state: 'Maharashtra', address: 'Kondhali, Nagpur', pincode: '441103', phone: '+91 74993 58403', email: 'nagpur@crl-demo.com', status: 'ACTIVE', createdAt: '2026-08-01T05:30:00.000Z' },
  { id: 'branch-mumbai', branchCode: 'BOM', name: 'Mumbai Hub', city: 'Mumbai', state: 'Maharashtra', address: 'Andheri East, Mumbai', pincode: '400069', phone: '+91 74993 58404', email: 'mumbai@crl-demo.com', status: 'ACTIVE', createdAt: '2026-08-02T05:30:00.000Z' },
];

export const demoCustomers = [
  { id: 'customer-001', customerCode: 'CUST-001', name: 'Aarav Traders', companyName: 'Aarav Traders Pvt Ltd', mobile: '9876543210', alternateMobile: '', email: 'aarav@example.test', address: 'Sitabuldi', city: 'Nagpur', state: 'Maharashtra', pincode: '440012', gstNumber: '27ABCDE1234F1Z5', status: 'ACTIVE', createdAt: '2026-08-03T05:30:00.000Z' },
];

export const demoShipments = [
  { id: 'shipment-001', lrNumber: 'SK-NGP-2026-000001', customerId: 'customer-001', customer: demoCustomers[0], senderName: 'Aarav Traders', receiverName: 'Mumbai Retail Store', origin: 'Nagpur', destination: 'Mumbai', originBranchId: demoBranches[0], destinationBranchId: demoBranches[1], status: 'IN_TRANSIT', currentLocation: 'Nashik Transit Hub', bookingDate: '2026-09-08T04:30:00.000Z', expectedDeliveryDate: '2026-09-11T12:00:00.000Z', createdAt: '2026-09-08T04:30:00.000Z', trackingHistory: [{ status: 'BOOKED', location: 'Nagpur Hub', timestamp: '2026-09-08T04:30:00.000Z' }, { status: 'IN_TRANSIT', location: 'Nashik Transit Hub', timestamp: '2026-09-09T07:15:00.000Z' }], documents: [] },
  { id: 'shipment-002', lrNumber: 'SK-NGP-2026-000002', customerId: 'customer-001', customer: demoCustomers[0], senderName: 'Aarav Traders', receiverName: 'Pune Retail Store', origin: 'Nagpur', destination: 'Pune', originBranchId: demoBranches[0], destinationBranchId: demoBranches[0], status: 'LR_IMAGE_UPLOADED', currentLocation: 'Pune Hub', bookingDate: '2026-09-09T05:30:00.000Z', expectedDeliveryDate: '2026-09-10T12:00:00.000Z', createdAt: '2026-09-09T05:30:00.000Z', trackingHistory: [{ status: 'BOOKED', location: 'Nagpur Hub', timestamp: '2026-09-09T05:30:00.000Z' }, { status: 'LR_IMAGE_UPLOADED', location: 'Pune Hub', timestamp: '2026-09-10T05:30:00.000Z' }], documents: [] },
];
