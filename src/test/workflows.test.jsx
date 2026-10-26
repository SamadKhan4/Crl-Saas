import { VendorSettlementSheet } from '../components/tms/VendorSettlement';
import { InvoiceSheet } from '../components/tms/TransportPrintLayouts';
import TmsModulePage from '../pages/TmsModulePage';
const restoredSession = vi.hoisted(() => ({ user: null }));
vi.mock('../api/client', async (original) => ({
  ...await original(),
  refreshSession: async () => ({ user: restoredSession.user, accessToken: 'test-only-token' }),
}));
import ActivityPage from '../pages/ActivityPage';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../features/auth/AuthContext';
import { logistic, api } from '../api/client';
import { ProtectedRoute } from '../routes/Guards';
import AppLayout from '../components/layout/AppLayout';
import ManagementPage from '../pages/ManagementPage';
import LoginPage from '../pages/LoginPage';
import CreateLRPage from '../pages/CreateLRPage';
import ShipmentsPage from '../pages/ShipmentsPage';
import ReceivePage from '../pages/ReceivePage';
import PublicPage from '../pages/PublicPage';
import ShipmentActions from '../components/shipment/ShipmentActions';
import ShipmentTable from '../components/shipment/ShipmentTable';
import FileUploader from '../components/forms/FileUploader';
import { actionsFor, validateFile } from '../lib/workflow';
import { shipmentSchema, customerSchema, lrCreateSchema } from '../schemas';
import { shipmentCreatePayload } from '../pages/CreateLRPage';
const origin = 'a'.repeat(24),
  destination = 'b'.repeat(24),
  customer = 'c'.repeat(24);
const admin = {
  id: 'admin',
  name: 'Test Admin',
  email: 'admin@example.test',
  role: 'ADMIN',
  status: 'ACTIVE',
};
const employee = {
  id: 'employee',
  name: 'Test Employee',
  role: 'EMPLOYEE',
  status: 'ACTIVE',
  branchId: destination,
};
const branchManager = { ...employee, id: 'manager', name: 'Test Manager', role: 'MANAGER' };
const shipment = {
  _id: 'd'.repeat(24),
  lrNumber: 'SK-NGP-2026-000001',
  customerId: { _id: customer, name: 'Test customer' },
  originBranchId: { _id: origin, name: 'Nagpur' },
  destinationBranchId: { _id: destination, name: 'Pune' },
  currentStatus: 'IN_TRANSIT',
};
const result = (data) => ({ data: { success: true, data } });
function mount(element, { user = null, path = '/', route = '*', extra = null } = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  if (user) {
    localStorage.setItem('crl-session-active', 'true');
    restoredSession.user = user;
  }
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <AuthProvider>
          <Routes>
            {user ? (
              <Route element={<ProtectedRoute role={user.role} />}>
                <Route path={route} element={element} />
              </Route>
            ) : (
              <Route path={route} element={element} />
            )}
            {extra}
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.restoreAllMocks();
});
describe('Branch and workflow permissions', () => {
  it('keeps employee operations create-and-view only', () => {
    expect(actionsFor(shipment, employee)).toEqual([]);
    expect(actionsFor(shipment, branchManager)).toContain('receive');
  });
  it('restricts verification and closure to admins', () => {
    expect(actionsFor({ ...shipment, currentStatus: 'LR_IMAGE_UPLOADED' }, employee)).toEqual([]);
    expect(actionsFor({ ...shipment, currentStatus: 'LR_IMAGE_UPLOADED' }, admin)).toEqual([
      'verify',
      'reject',
    ]);
    expect(actionsFor({ ...shipment, currentStatus: 'COMPLETED' }, employee)).toEqual([]);
  });
  it('prevents terminal and disabled-user actions', () => {
    expect(actionsFor({ ...shipment, currentStatus: 'CLOSED' }, admin)).toEqual([]);
    expect(actionsFor(shipment, { ...admin, status: 'INACTIVE' })).toEqual([]);
  });
  it('rejects arbitrary roles', () =>
    expect(actionsFor(shipment, { ...admin, role: 'CUSTOMER' })).toEqual([]));
});
describe('Form validation', () => {
  const valid = {
    lrNumber: "MANUAL-001",
    customerId: customer,
    originBranchId: origin,
    destinationBranchId: destination,
    senderName: 'Sender',
    receiverName: 'Receiver',
    packageCount: 1,
    weightKg: 5,
  };
  it('allows internal office references while requiring positive weight and whole package counts', () => {
    expect(shipmentSchema.safeParse(valid).success).toBe(true);
    expect(shipmentSchema.safeParse({ ...valid, destinationBranchId: origin }).success).toBe(true);
    for (const patch of [{ weightKg: 0 }, { packageCount: 1.5 }])
      expect(shipmentSchema.safeParse({ ...valid, ...patch }).success).toBe(false);
  });
  it('accepts the reserved retail customer key', () => {
    expect(shipmentSchema.safeParse({ ...valid, customerId: 'RETAIL' }).success).toBe(true);
  });
  it('omits empty optional contact fields', () =>
    expect(
      customerSchema.parse({ customerType: 'TO_PAY_PAID', name: 'Customer', mobile: '+919876543210', email: '', pincode: '' })
        .email,
    ).toBeUndefined());
  it('nests LR print fields in the documented shipment contract', () => {
    const pickupRequestId = '507f1f77bcf86cd799439014';
    const values = lrCreateSchema.parse({
      goods: [{ description: "Boxes", quantity: 1, actualWeight: 5, dimensionUnit: "CM" }],
      ...valid,
      pickupRequestId,
      from: 'Nagpur',
      to: 'Amravati',
      consignorCode: 'TEST-001',
      invoiceNo: 'INV-1001',
      actualWeight: '4.5',
      paymentMode: 'TO_PAY',
      freightBasis: 'PER_KG',
      freightRate: '300',
      fuelRatePercent: '10',
    });
    expect(shipmentCreatePayload(values)).toMatchObject({
      ...valid,
      pickupRequestId,
      lrDetails: {
        consignorCode: 'TEST-001',
        invoiceNo: 'INV-1001',
        actualWeight: 5,
        paymentMode: 'TO_PAY',
        freightBasis: 'PER_KG',
        freightRate: 300,
        freightCharges: 1500,
        fuelCharges: 150,
        totalAmount: 1650,
      },
    });
    expect(shipmentCreatePayload(values).invoiceNo).toBeUndefined();
    expect(shipmentCreatePayload({ ...values, packageCount: 7, weightKg: 42.5 }, { packageCount: 'MANUAL', weight: 'MANUAL' })).toMatchObject({
      packageCount: 7,
      weightKg: 42.5,
    });
  });
});
describe('Authentication and routing', () => {
  it('submits only credentials to the real login contract', async () => {
    const login = vi
      .spyOn(logistic, 'post')
      .mockResolvedValue(result({ user: admin, accessToken: 'token' }));
    mount(<LoginPage />, {
      path: '/login',
      route: '/login',
      extra: <Route path="/admin/dashboard" element={<h1>Admin home</h1>} />,
    });
    await userEvent.type(await screen.findByLabelText('Work email'), 'admin@example.test');
    await userEvent.type(screen.getByLabelText('Password'), 'long-password');
    await userEvent.click(screen.getByRole('button', { name: /Sign in to workspace/i }));
    expect(await screen.findByText('Admin home')).toBeInTheDocument();
    expect(login).toHaveBeenCalledWith('/auth/login', {
      email: 'admin@example.test',
      password: 'long-password',
    }, { __skipAuthRefresh: true });
  });
  it('redirects unauthenticated direct access to login', async () => {
    mount(<ProtectedRoute role="ADMIN" />, {
      path: '/admin/employees',
      route: '/admin/employees',
      extra: <Route path="/login" element={<h1>Sign in required</h1>} />,
    });
    expect(await screen.findByText('Sign in required')).toBeInTheDocument();
  });
  it('blocks employee access to administrator URLs', async () => {
    mount(<ProtectedRoute role="ADMIN" />, {
      user: employee,
      path: '/admin/employees',
      route: '/admin/employees',
      extra: <Route path="/employee/shipments" element={<h1>Employee home</h1>} />,
    });
    expect(await screen.findByText('Employee home')).toBeInTheDocument();
  });
});
describe('Operational pages', () => {
  it('shows shipment view without mutation controls to employees', async () => {
    mount(<ShipmentTable base="/employee" rows={[shipment]} />, { user: employee });
    expect(await screen.findByRole('link', { name: `View ${shipment.lrNumber}` })).toBeVisible();
    expect(screen.queryByText('More actions')).not.toBeInTheDocument();
  });
  it('loads shipment records through the API boundary', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({
      ...result([shipment]),
      data: { ...result([shipment]).data, pagination: { page: 1, pages: 1, total: 1, limit: 20 } },
    });
    mount(<ShipmentsPage />, { user: admin });
    expect(await screen.findByText(shipment.lrNumber)).toBeInTheDocument();
  });
  it('validates LR creation before submitting', async () => {
    const mutation = vi.spyOn(api, 'post');
    vi.spyOn(api, 'get').mockResolvedValue(result([]));
    mount(<CreateLRPage />, { user: admin });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Create LR' })).toBeInTheDocument(),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Create LR' }));
    expect(await screen.findAllByText(/Invalid input|Select a valid|Too small/)).not.toHaveLength(
      0,
    );
    expect(mutation).not.toHaveBeenCalled();
  });
  it('requires receipt confirmation and sends the receiving contract', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(result([shipment]));
    const mutation = vi.spyOn(api, 'post').mockResolvedValue(result(shipment));
    mount(<ReceivePage />, { user: branchManager });
    await userEvent.type(await screen.findByLabelText('LR number'), shipment.lrNumber);
    await userEvent.click(screen.getByRole('button', { name: 'Find shipment' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Receive parcel' }));
    expect(mutation).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText('Receiving location'), 'Pune dock');
    await userEvent.click(screen.getByRole('button', { name: 'Confirm receive parcel' }));
    await waitFor(() =>
      expect(mutation).toHaveBeenCalledWith(
        `/shipments/${shipment._id}/receive`,
        { location: 'Pune dock', remarks: '' },
        undefined,
      ),
    );
  });
  it('requires a reason before rejecting a document', async () => {
    const mutation = vi.spyOn(api, 'post').mockResolvedValue(result({}));
    mount(<ShipmentActions shipment={{ ...shipment, currentStatus: 'LR_IMAGE_UPLOADED' }} />, {
      user: admin,
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Reject document' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirm reject document' }));
    expect(mutation).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText('Rejection reason'), 'Signature is missing');
    await userEvent.click(screen.getByRole('button', { name: 'Confirm reject document' }));
    await waitFor(() =>
      expect(mutation).toHaveBeenCalledWith(
        `/shipments/${shipment._id}/lr-image/verify`,
        { status: 'REJECTED', remarks: 'Signature is missing' },
        undefined,
      ),
    );
  });
});
describe('Documents and public access', () => {
  it('rejects oversized, empty and unsupported files', () => {
    expect(
      validateFile({ name: 'lr.pdf', type: 'application/pdf', size: 11 * 1024 * 1024 }),
    ).toMatch(/10 MB/);
    expect(validateFile({ name: 'bad.exe', type: 'image/png', size: 100 })).toMatch(/Choose/);
    expect(validateFile({ name: 'lr.png', type: 'image/png', size: 0 })).toMatch(/empty/);
  });
  it('uploads multipart using the required lrImage field', async () => {
    const upload = vi.fn().mockResolvedValue({});
    render(<FileUploader onUpload={upload} />);
    const file = new File(['test document'], 'signed.pdf', { type: 'application/pdf' });
    await userEvent.upload(screen.getByLabelText('LR document'), file);
    await userEvent.click(screen.getByRole('button', { name: 'Upload document' }));
    expect(upload.mock.calls[0][0].get('lrImage')).toBe(file);
  });
  it('tracks publicly without requesting internal details', async () => {
    const get = vi.spyOn(logistic, 'get').mockResolvedValue(
      result({
        lrNumber: shipment.lrNumber,
        status: 'IN_TRANSIT',
        origin: 'Nagpur',
        destination: 'Pune',
        trackingHistory: [],
      }),
    );
    mount(<PublicPage />, { path: '/track' });
    await userEvent.type(screen.getByLabelText('LR number'), shipment.lrNumber);
    await userEvent.click(screen.getByRole('button', { name: 'Track shipment' }));
    expect(await screen.findByRole('heading', { name: shipment.lrNumber })).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith(`/public/track/${shipment.lrNumber}`);
    expect(screen.queryByText('Test customer')).not.toBeInTheDocument();
  });
  it('shows an invalid public upload token without a request', () => {
    mount(<PublicPage />, { path: '/upload-lr/invalid', route: '/upload-lr/:token' });
    expect(screen.getByText(/This upload link is invalid/)).toBeInTheDocument();
  });
  it('shows public upload success only after API success', async () => {
    vi.spyOn(logistic, 'post').mockResolvedValue(result({}));
    mount(<PublicPage />, { path: `/upload-lr/${'a'.repeat(64)}`, route: '/upload-lr/:token' });
    await userEvent.upload(
      screen.getByLabelText('LR document'),
      new File(['pdf'], 'lr.pdf', { type: 'application/pdf' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Upload document' }));
    expect(await screen.findByText('Your document is pending verification.')).toBeInTheDocument();
  });
});

describe('Manager workspace', () => {
  const manager = branchManager;
  it('allows managers to verify and close shipments across branches', () => {
    expect(actionsFor({ ...shipment, currentStatus: 'LR_IMAGE_UPLOADED' }, manager)).toEqual([
      'verify',
      'reject',
    ]);
    expect(actionsFor({ ...shipment, currentStatus: 'COMPLETED' }, manager)).toEqual(['close']);
    expect(
      actionsFor(
        { ...shipment, currentStatus: 'LR_IMAGE_UPLOADED' },
        { ...manager, branchId: origin },
      ),
    ).toEqual(['verify', 'reject']);
    expect(
      actionsFor({ ...shipment, currentStatus: 'COMPLETED' }, { ...manager, branchId: origin }),
    ).toEqual(['close']);
  });
  it('restores manager sessions and renders manager-only navigation', async () => {
    mount(<AppLayout />, { user: manager, path: '/manager/dashboard' });
    expect(await screen.findByText('Manager workspace')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Masters' }));
    expect(screen.getByRole('link', { name: 'Employee Master' })).toHaveAttribute(
      'href',
      '/manager/employees',
    );
    await userEvent.click(screen.getByRole('button', { name: 'MIS & Reports' }));
    expect(screen.getByRole('link', { name: 'Godown Stock' })).toHaveAttribute('href', '/manager/reports/godown-stock');
    await userEvent.click(screen.getByRole('button', { name: 'Controls' }));
    expect(screen.getByRole('link', { name: 'Operational Settings' })).toHaveAttribute('href', '/manager/system-settings');
    expect(screen.getByRole('link', { name: 'HR Master' })).toHaveAttribute('href', '/manager/hr-users');
    expect(screen.getByRole('link', { name: 'User Permission' })).toHaveAttribute('href', '/manager/permissions');
    expect(screen.getByRole('link', { name: 'Vendor Master' })).toHaveAttribute('href', '/manager/vendors');
    expect(screen.queryByRole('link', { name: 'Manager Master' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Branch Master' })).toHaveAttribute('href', '/manager/branches');
    const commercial = screen.getByRole('button', { name: 'Commercial' });
    expect(commercial).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(commercial);
    expect(screen.getByRole('link', { name: 'Client Billing' })).toHaveAttribute('href', '/manager/invoices');
    await userEvent.click(commercial);
    expect(screen.queryByRole('link', { name: 'Client Billing' })).not.toBeInTheDocument();


  });
  it('redirects manager away from admin routes', async () => {
    mount(<ProtectedRoute role="ADMIN" />, {
      user: manager,
      path: '/admin/managers',
      route: '/admin/managers',
      extra: <Route path="/manager/dashboard" element={<h1>Manager home</h1>} />,
    });
    expect(await screen.findByText('Manager home')).toBeInTheDocument();
  });
  it('loads the admin manager directory from its own endpoint', async () => {
    const fetch = vi.spyOn(api, 'get').mockResolvedValue({
      data: { success: true, data: [], pagination: { page: 1, pages: 0, total: 0, limit: 20 } },
    });
    mount(<ManagementPage />, { user: admin, path: '/admin/managers' });
    expect(await screen.findByRole('heading', { name: 'Managers' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add manager' })).toBeInTheDocument();
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/managers', expect.anything()));
  });
});

describe('Activity feed', () => {
  it('renders the actor, action and record from the real activity envelope', async () => {
    const fetch = vi
      .spyOn(api, 'get')
      .mockResolvedValue({
        data: {
          success: true,
          data: [
            {
              id: 'activity-1',
              actor: { name: 'Branch Operator', role: 'EMPLOYEE' },
              action: 'CUSTOMER_CREATED',
              entityType: 'Customer',
              entityId: customer,
              entityLabel: 'New Customer',
              createdAt: '2026-09-07T10:00:00Z',
              changedFields: [],
            },
          ],
          pagination: { page: 1, pages: 1, total: 1, limit: 20 },
        },
      });
    mount(<ActivityPage />, { user: admin, path: '/admin/audit' });
    expect(await screen.findByText('Branch Operator')).toBeInTheDocument();
    expect(screen.getByText('Customer Created')).toBeInTheDocument();
    expect(screen.getByText('New Customer')).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith('/activity', expect.anything());
  });
  it('shows retry controls for a failed activity request', async () => {
    vi.spyOn(api, 'get').mockRejectedValue({ response: { status: 503 } });
    mount(<ActivityPage />, { user: branchManager, path: '/manager/activity' });
    expect(
      await screen.findByText('The server could not complete this request. Please try again.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /try again/i }));
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
  });
});


describe('Client billing tabs', () => {
  const retailLr = { _id: 'retail-lr', lrNumber: 'LR-RETAIL-1', customerId: 'retail-account', senderName: 'Retail Sender', receiverName: 'Retail Receiver', lrDetails: { paymentMode: 'TO_PAY', bookingDate: '2026-10-12T00:00:00.000Z', gstRate: 5, gstAmount: 50, totalAmount: 1050 } };
  function mockBilling() {
    return vi.spyOn(api, 'get').mockImplementation(async (path) => result(path === '/customers' ? [{ _id: customer, name: 'Credit Client', customerType: 'CREDIT' }] : path === '/invoices/billable-lrs' ? [retailLr] : []));
  }
  it('fetches credit LRs only after selecting a customer', async () => {
    const getSpy = mockBilling();
    mount(<TmsModulePage />, { user: branchManager, path: '/manager/invoices' });
    await userEvent.click(await screen.findByRole('button', { name: 'Add invoice' }));
    expect(screen.getByText('Select a credit customer to fetch eligible LRs.')).toBeInTheDocument();
    await userEvent.selectOptions(await screen.findByLabelText('Credit customer', { selector: 'select' }), customer);
    await screen.findByText('LR-RETAIL-1');
    expect(getSpy).toHaveBeenCalledWith('/invoices/billable-lrs', expect.objectContaining({ params: expect.objectContaining({ customerId: customer, billingType: 'CREDIT' }) }));
  });
  it('resets GST to zero when switching to an LR without GST', async () => {
    const noGst = { ...retailLr, _id: 'no-gst', lrNumber: 'LR-NO-GST', lrDetails: {} };
    vi.spyOn(api, 'get').mockImplementation(async (path) => result(path === '/invoices/billable-lrs' ? [retailLr, noGst] : []));
    mount(<TmsModulePage />, { user: branchManager, path: '/manager/invoices' });
    await userEvent.click(await screen.findByRole('tab', { name: 'Retail Customer' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add invoice' }));
    await screen.findByRole('option', { name: 'LR-RETAIL-1' });
    await userEvent.selectOptions(screen.getByLabelText('Retail LR (9966)'), 'retail-lr');
    expect(screen.getByLabelText('GST %')).toHaveValue(5);
    expect(screen.getByRole('checkbox', { name: 'GST available' })).toBeChecked();
    await userEvent.click(screen.getByRole('checkbox', { name: 'GST available' }));
    expect(screen.getByLabelText('GST %')).toHaveValue(0);
    expect(screen.getByLabelText('GST %')).toBeDisabled();
    await userEvent.selectOptions(screen.getByLabelText('Retail LR (9966)'), 'no-gst');
    expect(screen.getByLabelText('GST %')).toHaveValue(0);
  });
  it('fetches the retail bill name from the LR and submits one LR', async () => {
    mockBilling();
    const postSpy = vi.spyOn(api, 'post').mockResolvedValue(result({ id: 'invoice' }));
    mount(<TmsModulePage />, { user: branchManager, path: '/manager/invoices' });
    await userEvent.click(await screen.findByRole('tab', { name: 'Retail Customer' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add invoice' }));
    await screen.findByRole('option', { name: 'LR-RETAIL-1' });
    await userEvent.selectOptions(screen.getByLabelText('Retail LR (9966)'), 'retail-lr');
    expect(screen.getByLabelText('Retail customer name')).toHaveValue('Retail Receiver');
    expect(screen.getByLabelText('Retail customer name')).toHaveAttribute('readonly');
    expect(screen.getByLabelText('GST %')).toHaveValue(5);
    expect(screen.getByLabelText('Invoice date')).toHaveValue('2026-10-12');
    expect(screen.getByLabelText('Billing period from')).toHaveValue('2026-10-12');
    expect(screen.getByLabelText('Billing period to')).toHaveValue('2026-10-12');
    await userEvent.clear(screen.getByLabelText('GST %'));
    await userEvent.type(screen.getByLabelText('GST %'), '12');
    await userEvent.clear(screen.getByLabelText('Invoice date'));
    await userEvent.type(screen.getByLabelText('Invoice date'), '2026-10-26');

    expect(screen.queryByRole('combobox', { name: 'Credit customer' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save invoice' }));
    await waitFor(() => expect(postSpy).toHaveBeenCalledWith('/invoices', expect.objectContaining({ billingType: 'RETAIL', customerId: 'retail-account', shipmentIds: ['retail-lr'], gstRate: '12', issueDate: '2026-10-26', periodFrom: '2026-10-12', periodTo: '2026-10-12' }), undefined));
    expect(postSpy.mock.calls[0][1]).not.toHaveProperty('retailName');
  });
});


describe('Invoice GST heading', () => {
  it.each([[true, 'TAX INVOICE'], [false, 'INVOICE']])('renders saved GST availability %s', (gstAvailable, heading) => {
    render(<InvoiceSheet invoice={{ gstAvailable, totalAmount: 0 }} />);
    expect(screen.getByText(heading, { exact: true })).toBeInTheDocument();
    if (!gstAvailable) expect(screen.queryByText(/IGST/)).not.toBeInTheDocument();
  });
});


describe('Vendor commission settlement', () => {
  it('fetches vendor work by selected code and shows master rate breakdown', async () => {
    const vendor = { _id: 'vendor-1', vendorCode: 'V001', name: 'Road Vendor' };
    const work = { vendor, shipments: [{ id: 'lr1', lrNumber: 'LR-VENDOR-1', weightKg: 20, packageCount: 3, freight: 500 }], operations: [{ key: 'TRIP:trip1', type: 'TRIP', number: 'TRIP-001', shipmentIds: ['lr1'], recordedCost: 400, advance: 10, eligible: true }], calculation: { rateBasis: 'PER_KG', agreedRate: 2, units: 20, commission: 40 }, advance: 10, settledLrCount: 0, defaults: { title: 'Commission settlement - V001 - Road Vendor', operationDate: '2026-10-26', dueDate: '2026-11-02', documentNumber: 'VCOM-V001-20261026', reference: 'TRIP-001', description: '1 LR commission', metadata: { detention: 0, loading: 0, otherCharge: 0, tds: 0, advance: 10 } } };
    const getSpy = vi.spyOn(api, 'get').mockImplementation(async (path) => result(path === '/vendors/options' ? [vendor] : path === '/vendors/vendor-1/settlement-work' ? work : []));
    mount(<TmsModulePage />, { user: branchManager, path: '/manager/vendor-settlements' });
    await userEvent.click(await screen.findByRole('button', { name: 'Add settlement invoice' }));
    await screen.findByRole('option', { name: /V001/ });
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Vendor' }), 'vendor-1');
    expect(await screen.findByText('LR-VENDOR-1')).toBeInTheDocument();
    expect(screen.getByText('TRIP-001')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Bill / settlement title')).toHaveValue('Commission settlement - V001 - Road Vendor'));
    expect(screen.getByLabelText('Vendor invoice number')).toHaveValue('VCOM-V001-20261026');
    expect(screen.getByLabelText('Trip / manifest reference')).toHaveValue('TRIP-001');
    expect(screen.getByLabelText('Advance paid')).toHaveValue(10);
    expect(screen.getByLabelText('Detention')).toHaveValue(0);
    expect(screen.getByLabelText('TDS deduction')).toHaveValue(0);
    expect(screen.getByLabelText('Payment due date')).toHaveValue('2026-11-02');
    await userEvent.clear(screen.getByLabelText('Bill / settlement title'));
    await userEvent.type(screen.getByLabelText('Bill / settlement title'), 'Edited settlement');
    expect(screen.getByLabelText('Bill / settlement title')).toHaveValue('Edited settlement');

    expect(screen.getByText(/PER_KG/)).toHaveTextContent('20 units');
    expect(screen.getByText('Net payable:').parentElement).toHaveTextContent('30.00');
    expect(getSpy).toHaveBeenCalledWith('/vendors/vendor-1/settlement-work', { params: undefined });
  });
});


describe('Vendor invoice print layout', () => {
  it('uses separate tables and paginates long operation lists before the totals', () => {
    const operations = Array.from({ length: 17 }, (_, index) => ({ key: `TRIP:${index}`, type: 'TRIP', number: `TRIP-${index}`, shipmentIds: [], recordedCost: 100, advance: 0 }));
    const { container } = render(<VendorSettlementSheet record={{ recordNumber: 'VST-TEST', amount: 3200, metadata: { operations, commission: 3200, rateBasis: 'PER_TRIP', units: 1, agreedRate: 3200 } }} />);
    expect(container.querySelectorAll('.vendor-settlement-page')).toHaveLength(4);
    expect(container.querySelectorAll('.vendor-operation-table')).toHaveLength(3);
    expect(container.querySelectorAll('.invoice-table')).toHaveLength(0);
    expect(screen.getByText('Page 4 of 4')).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: 'Net payable' }).parentElement).toHaveTextContent('3,200.00');
  });
});


describe('Restored Branch Master', () => {
  const branch = { _id: origin, branchCode: 'NGP', name: 'Nagpur Branch', city: 'Nagpur', state: 'Maharashtra', status: 'ACTIVE' };
  it('lets admins edit an existing branch', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ data: { success: true, data: [branch], pagination: { page: 1, pages: 1, total: 1, limit: 20 } } });
    const update = vi.spyOn(api, 'put').mockResolvedValue(result(branch));
    mount(<ManagementPage />, { user: admin, path: '/admin/branches' });
    expect(await screen.findByText('Nagpur Branch')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add branch' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const name = screen.getByLabelText('Branch name');
    await userEvent.clear(name);
    await userEvent.type(name, 'Nagpur Main Branch');
    await userEvent.click(screen.getByRole('button', { name: 'Save branch' }));
    await waitFor(() => expect(update).toHaveBeenCalledWith(`/branches/${origin}`, expect.objectContaining({ name: 'Nagpur Main Branch', branchCode: 'NGP' })));
  });
  it('lets managers view branches without offering unauthorized edits', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ data: { success: true, data: [branch], pagination: { page: 1, pages: 1, total: 1, limit: 20 } } });
    mount(<ManagementPage />, { user: branchManager, path: '/manager/branches' });
    expect(await screen.findByText('Nagpur Branch')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add branch' })).not.toBeInTheDocument();
  });
});
