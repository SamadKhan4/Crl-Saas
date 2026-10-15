import { it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AgentAlignmentPage from '../pages/AgentAlignmentPage';
import { pickupRequestsApi, customersApi } from '../api/services';
vi.mock('../features/auth/AuthContext', () => ({ useAuth: () => ({ user: { role: 'ADMIN' } }) }));
vi.mock('../api/services', () => ({
  customersApi: { lookup: vi.fn(async () => ({ data: [{ _id: 'credit', customerCode: '10001', customerType: 'CREDIT', companyName: 'Credit Company', name: 'Contact', mobile: '9876543210', city: 'Nagpur' }] })) },
  pickupRequestsApi: { create: vi.fn(async () => ({ data: { _id: 'new-pur', pickupRequestNumber: 'PUR-NEW' } })), list: async () => ({ data: [{ _id: 'pur', pickupRequestNumber: 'PUR001' }] }), assignAgent: vi.fn(async () => ({ data: {} })) },
  vendorsApi: { list: async () => ({ data: [{ _id: 'vendor', name: 'Vendor', marketVehicles: [{ vehicleNumber: 'MH31MK1234', driverName: 'Market Driver', driverMobile: '9876543210' }], vehicles: [{ vehicleNumber: 'MH31AB1234', vehicleType: 'Truck', driverName: 'Driver', driverMobile: '9876543210' }] }] }) },
  masterOptionsApi: { list: async () => ({ data: [{ _id: 'route', name: 'Nagpur Express' }] }) },
}));
it('assigns vendor and driver without assigning a trip route', async () => {
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={cache}><MemoryRouter><AgentAlignmentPage /></MemoryRouter></QueryClientProvider>);
  await userEvent.click(await screen.findByRole('button', { name: 'Align agent' }));
  await userEvent.selectOptions(screen.getByLabelText('Vendor / pickup agent *'), 'vendor');
  expect(screen.queryByLabelText("Route *")).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Remarks')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Save alignment' }));
  await waitFor(() => expect(pickupRequestsApi.assignAgent).toHaveBeenCalledWith('pur', expect.objectContaining({ vendorId: 'vendor' })));
});

it('creates a new credit request and assigns its agent before LR creation', async () => {
  vi.clearAllMocks();
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={cache}><MemoryRouter><AgentAlignmentPage /></MemoryRouter></QueryClientProvider>);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Assign Agent' })).toBeEnabled());
  await userEvent.click(screen.getByRole('button', { name: 'Assign Agent' }));
  await screen.findByRole('option', { name: /Credit Company/ });
  await userEvent.selectOptions(screen.getByLabelText('Credit customer *'), 'credit');
  expect(customersApi.lookup).toHaveBeenCalledWith(expect.objectContaining({ customerType: 'CREDIT' }));
  expect(screen.getAllByLabelText('Company name *')[0]).toHaveValue('Credit Company');
  await userEvent.type(screen.getAllByLabelText('Company name *')[1], 'Recipient');
  await userEvent.type(screen.getAllByLabelText('City *')[1], 'Pune');
  await userEvent.click(screen.getByRole('button', { name: 'Create request & assign agent' }));
  await waitFor(() => expect(pickupRequestsApi.create).toHaveBeenCalledWith(expect.objectContaining({
    customerId: 'credit', shipper: expect.objectContaining({ companyName: 'Credit Company' }), recipient: { companyName: 'Recipient', city: 'Pune' },
  })));
  await userEvent.selectOptions(await screen.findByLabelText('Vendor / pickup agent *'), 'vendor');
  await userEvent.click(screen.getByRole('button', { name: 'Save alignment' }));
  await waitFor(() => expect(pickupRequestsApi.assignAgent).toHaveBeenCalledWith('new-pur', expect.objectContaining({ vendorId: 'vendor' })));
});

for (const selectAgent of [true, false]) {
  it(`assigns a market vehicle ${selectAgent ? 'with an optional saved agent' : 'manually without an agent selection'}`, async () => {
    vi.clearAllMocks();
    const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={cache}><MemoryRouter><AgentAlignmentPage /></MemoryRouter></QueryClientProvider>);
    await userEvent.click(await screen.findByRole('button', { name: 'Align agent' }));
    await userEvent.selectOptions(screen.getByLabelText('Vehicle source *'), 'MARKET');
    if (selectAgent) {
      await userEvent.selectOptions(screen.getByLabelText('Market agent (optional)'), 'vendor');
      expect(screen.getByLabelText('Vehicle number *')).toHaveValue('MH31MK1234');
    } else {
      await userEvent.type(screen.getByLabelText('Market agent / owner name *'), 'Manual Agent');
      await userEvent.type(screen.getByLabelText('Vehicle number *'), 'MH31MN1234');
      await userEvent.type(screen.getByLabelText('Driver name *'), 'Manual Driver');
      await userEvent.type(screen.getByLabelText('Driver mobile *'), '9876543210');
    }
    await userEvent.click(screen.getByRole('button', { name: 'Save alignment' }));
    await waitFor(() => expect(pickupRequestsApi.assignAgent).toHaveBeenCalledWith('pur', expect.objectContaining({ sourceType: 'MARKET', vehicleNumber: selectAgent ? 'MH31MK1234' : 'MH31MN1234' })));
    const body = pickupRequestsApi.assignAgent.mock.calls[0][1];
    if (selectAgent) expect(body.vendorId).toBe('vendor');
    else expect(body).not.toHaveProperty('vendorId');
  });
}

for (const sourceType of ['VENDOR', 'MARKET']) {
  it(`fills saved vehicle details and clears stale details for ${sourceType}`, async () => {
    const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={cache}><MemoryRouter><AgentAlignmentPage /></MemoryRouter></QueryClientProvider>);
    await userEvent.click(await screen.findByRole('button', { name: 'Align agent' }));
    await userEvent.selectOptions(screen.getByLabelText('Vehicle source *'), sourceType);
    await userEvent.selectOptions(screen.getByLabelText(sourceType === 'MARKET' ? 'Market agent (optional)' : 'Vendor / pickup agent *'), 'vendor');
    await userEvent.selectOptions(screen.getByLabelText('Saved vehicle'), 'MH31AB1234');
    expect(screen.getByLabelText('Vehicle type')).toHaveValue('Truck');
    expect(screen.getByLabelText('Driver name *')).toHaveValue('Driver');
    expect(screen.getByLabelText('Driver mobile *')).toHaveValue('9876543210');
    if (sourceType === 'MARKET') {
      await userEvent.selectOptions(screen.getByLabelText('Saved vehicle'), 'MH31MK1234');
      expect(screen.getByLabelText('Driver name *')).toHaveValue('Market Driver');
      expect(screen.getByLabelText('Vehicle type')).toHaveValue('');
    }
    await userEvent.clear(screen.getByLabelText('Vehicle number *'));
    await userEvent.type(screen.getByLabelText('Vehicle number *'), 'MH31NEW1234');
    expect(screen.getByLabelText('Driver name *')).toHaveValue('');
    expect(screen.getByLabelText('Driver mobile *')).toHaveValue('');
  });
}
