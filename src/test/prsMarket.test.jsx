import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PickupRunSheetsPage from '../pages/PickupRunSheetsPage';

vi.mock('../features/auth/AuthContext', () => ({ useAuth: () => ({ user: { role: 'ADMIN' } }) }));
vi.mock('../api/services', () => ({
  branchesApi: {}, usersApi: {},
  pickupRunSheetsApi: {
    list: async () => ({ data: [] }),
    options: async () => ({ data: {
      vendors: [{ _id: 'vendor-1', vendorCode: 'V001', name: 'Mapped vendor', vehicles: [{ vehicleNumber: 'MH31VV1234', vehicleType: 'Truck', status: 'ACTIVE' }] }],
      fieldExecutives: [],
      marketVehicles: [{ pickupRequestId: 'pickup-1', pickupRequestNumber: 'PUR001', agentName: 'Market Owner', vehicleNumber: 'MH31MV1234', vehicleType: 'Tata Ace' }],
    } }),
  },
}));

describe('PRS market vehicle selection', () => {
  it('reflects owner and vehicle details and clears them when the source changes', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter><PickupRunSheetsPage /></MemoryRouter></QueryClientProvider>);
    const market = await screen.findByRole('option', { name: 'Market Owner · MH31MV1234 · Tata Ace · PUR001' });
    const owner = market.closest('select');
    await userEvent.selectOptions(owner, 'market:pickup-1');
    expect(screen.getByDisplayValue('Tata Ace')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'MH31MV1234 · Tata Ace' }).selected).toBe(true);
    expect(screen.getByRole('option', { name: 'Market rate' }).closest('select')).toBeDisabled();
    expect(screen.getByText('Market amount (manager approval required)')).toBeInTheDocument();
    await userEvent.selectOptions(owner, 'vendor-1');
    expect(screen.getByDisplayValue('Truck')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'MH31VV1234 · Truck' }).selected).toBe(true);
    expect(screen.getByRole('option', { name: 'Market rate' }).closest('select')).not.toBeDisabled();
    await userEvent.selectOptions(owner, '');
    expect(screen.getByRole('option', { name: 'Select vendor vehicle' }).selected).toBe(true);
    expect(screen.queryByDisplayValue('Truck')).not.toBeInTheDocument();
  });
});
