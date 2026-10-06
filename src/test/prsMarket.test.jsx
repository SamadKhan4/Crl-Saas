import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PickupRunSheetsPage from '../pages/PickupRunSheetsPage';
import { pickupRunSheetsApi } from '../api/services';

vi.mock('../features/auth/AuthContext', () => ({ useAuth: () => ({ user: { role: 'ADMIN' } }) }));
vi.mock('../api/services', () => ({
  branchesApi: {}, usersApi: {},
  masterOptionsApi: { list: vi.fn(async (_type, { page }) => ({ data: page === 1 ? [{ _id: 'route-1', name: 'Nagpur Express' }] : [{ _id: 'route-2', name: 'Mumbai Local' }], pagination: { page, pages: 2 } })) },
  pickupRunSheetsApi: {
    create: vi.fn(async () => ({ data: { _id: 'prs-1', prsNumber: 'PRS-001' } })),
    list: async () => ({ data: [] }),
    options: async () => ({ data: {
      vendors: [{ _id: 'vendor-1', vendorCode: 'V001', name: 'Mapped vendor', vehicles: [{ vehicleNumber: 'MH31VV1234', vehicleType: 'Truck', status: 'ACTIVE' }] }],
      pickups: [
        { _id: 'pur-vendor', branchId: 'branch-1', shipmentId: { lrNumber: 'LR-VENDOR', customerId: { companyName: 'Acme Client' }, lrDetails: { to: 'Pune', paymentMode: 'TO_PAY', totalAmount: 1250 } }, agentAssignment: { sourceType: 'VENDOR', vendorId: 'vendor-1' }, shipper: { city: 'Nagpur' }, recipient: { city: 'Pune' } },
        { _id: 'pickup-1', shipmentId: { lrNumber: 'LR-MARKET' }, agentAssignment: { sourceType: 'MARKET' }, shipper: { city: 'Mumbai' }, recipient: { city: 'Pune' } },
        { _id: 'other', shipmentId: { lrNumber: 'LR-OTHER' }, agentAssignment: { sourceType: 'VENDOR', vendorId: 'vendor-2' } },
      ],
      fieldExecutives: [{ _id: 'fe-1', name: 'Test FE', branchId: 'another-branch' }],
      marketVehicles: [{ pickupRequestId: 'pickup-1', lrNumber: 'LR-MARKET', agentName: 'Market Owner', vehicleNumber: 'MH31MV1234', vehicleType: 'Tata Ace' }],
    } }),
  },
}));

describe('PRS market vehicle selection', () => {
  it('reflects owner and vehicle details and clears them when the source changes', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter><PickupRunSheetsPage /></MemoryRouter></QueryClientProvider>);
    const market = await screen.findByRole('option', { name: 'Market Owner · MH31MV1234 · Tata Ace · LR-MARKET' });
    const owner = market.closest('select');
    await userEvent.selectOptions(owner, 'market:pickup-1');
    expect(screen.getByText('LR-MARKET')).toBeInTheDocument();
    expect(screen.queryByText('LR-VENDOR')).not.toBeInTheDocument();
    expect(screen.queryByText('LR-OTHER')).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('Tata Ace')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'MH31MV1234 · Tata Ace' }).selected).toBe(true);
    expect(screen.getByRole('option', { name: 'Market rate' }).closest('select')).toBeDisabled();
    expect(screen.getByText('Market amount (rate review required)')).toBeInTheDocument();
    await userEvent.selectOptions(owner, 'vendor-1');
    expect(screen.getByText('LR-VENDOR')).toBeInTheDocument();
    expect(screen.queryByText('LR-MARKET')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Include LR-VENDOR')).toBeChecked();
    await userEvent.click(screen.getByLabelText('Include LR-VENDOR'));
    expect(screen.getByRole('button', { name: 'Create PRS' })).toBeDisabled();
    expect(screen.getByDisplayValue('Truck')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'MH31VV1234 · Truck' }).selected).toBe(true);
    expect(screen.getByRole('option', { name: 'Market rate' }).closest('select')).not.toBeDisabled();
    await userEvent.selectOptions(owner, '');
    expect(screen.getByRole('option', { name: 'Select vendor vehicle' }).selected).toBe(true);
    expect(screen.queryByDisplayValue('Truck')).not.toBeInTheDocument();
  });
});

it('submits vendor LRs with an FE from another branch, payment and route', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter><PickupRunSheetsPage /></MemoryRouter></QueryClientProvider>);
  const vendor = await screen.findByRole('option', { name: /V001/ });
  await userEvent.selectOptions(vendor.closest('select'), 'vendor-1');
  await userEvent.selectOptions(screen.getByLabelText('Field Executive *'), 'fe-1');
  expect(screen.getByText('Acme Client')).toBeInTheDocument();
  expect(screen.getByText('To Pay')).toBeInTheDocument();
  expect(screen.getByText('1,250')).toBeInTheDocument();
  expect(screen.queryByText('PUR number')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Create PRS' }));
  await waitFor(() => expect(pickupRunSheetsApi.create).toHaveBeenCalledWith(expect.objectContaining({
    vendorId: 'vendor-1', fieldExecutiveId: 'fe-1',
    pickups: [{ pickupRequestId: 'pur-vendor' }],
  })));
});

it('does not ask for a route again in PRS creation', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter><PickupRunSheetsPage /></MemoryRouter></QueryClientProvider>);
  await screen.findByRole('option', { name: /V001/ });
  expect(screen.queryByPlaceholderText('Select or enter route')).not.toBeInTheDocument();
});
