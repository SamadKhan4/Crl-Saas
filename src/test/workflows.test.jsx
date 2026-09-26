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
    sessionStorage.setItem('crl -session', 'true');
    vi.spyOn(logistic, 'post').mockResolvedValue(result({ user, accessToken: 'test-only-token' }));
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
  it('requires distinct branches, positive weight and whole package counts', () => {
    expect(shipmentSchema.safeParse(valid).success).toBe(true);
    for (const patch of [{ destinationBranchId: origin }, { weightKg: 0 }, { packageCount: 1.5 }])
      expect(shipmentSchema.safeParse({ ...valid, ...patch }).success).toBe(false);
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
    });
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
      expect(screen.getByRole('button', { name: 'Generate LR' })).toBeInTheDocument(),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Generate LR' }));
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
  it('allows verification and closure only for destination managers', () => {
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
    ).toEqual([]);
    expect(
      actionsFor({ ...shipment, currentStatus: 'COMPLETED' }, { ...manager, branchId: origin }),
    ).toEqual([]);
  });
  it('restores manager sessions and renders manager-only navigation', async () => {
    mount(<AppLayout />, { user: manager, path: '/manager/dashboard' });
    expect(await screen.findByText('Manager workspace')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Masters' }));
    expect(screen.getByRole('link', { name: 'Employees' })).toHaveAttribute(
      'href',
      '/manager/employees',
    );
    expect(screen.getByRole('link', { name: 'Reports' })).toHaveAttribute(
      'href',
      '/manager/reports',
    );
    expect(screen.queryByRole('link', { name: 'Managers' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Branches' })).not.toBeInTheDocument();
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
