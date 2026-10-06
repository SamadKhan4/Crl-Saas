import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MiddleMilePage from '../pages/MiddleMilePage';
import { middleMileApi } from '../api/services';
vi.mock('../features/auth/AuthContext', () => ({ useAuth: () => ({ user: { role: 'ADMIN' } }) }));
vi.mock('../api/services', () => ({
  masterOptionsApi: { list: async () => ({ data: [{ _id: 'route', name: 'Nagpur Mumbai', origin: 'Nagpur', destination: 'Mumbai' }] }) },
  vendorOptionsApi: { list: async () => ({ data: [] }) },
  middleMileApi: {
    sort: vi.fn(async () => ({ data: { _id: 'sorting', segregationNumber: 'SEG001' } })),
    sortings: async () => ({ data: [{ _id: 'sorting', segregationNumber: 'SEG001', destination: 'Mumbai', routeId: { _id: 'route', name: 'Nagpur Mumbai' }, shipmentIds: [{ _id: 'lr', lrNumber: 'LR001', weightKg: 20 }] }] }),
    sortingInventory: vi.fn(async () => ({ data: [{ _id: 'lr', lrNumber: 'LR001', lrDetails: { to: 'Mumbai', consigneePincode: '400001' }, packageCount: 2, weightKg: 20 }] })),
    tallies: { list: async () => ({ data: [{ _id: 'tally', tallyNumber: 'LT001', totalLrs: 1 }] }), create: vi.fn(async () => ({ data: { _id: 'tally', tallyNumber: 'LT002' } })), detail: async () => ({ data: { tallyNumber: 'LT001', loadingBay: 'Bay 2', vehicleType: 'Truck', vehicleCapacityKg: 1000, totalLrs: 1, items: [{ shipmentId: { _id: 'lr', lrNumber: 'LR001' }, expectedPackages: 2, weightKg: 20 }] } }) },
    manifests: { list: async () => ({ data: [{ _id: 'manifest', manifestNumber: 'MNF001', destination: 'Mumbai', workflowStatus: 'LOCKED', totalLrs: 1, totalWeightKg: 20 }] }), create: vi.fn(async () => ({ data: { manifestNumber: 'MNF001' } })) },
    trips: { create: vi.fn(async () => ({ data: { tripNumber: 'TRIP002' } })), list: async () => ({ data: [{ _id: 'trip', tripNumber: 'TRIP001', status: 'PLANNED', sealNumber: 'SEAL001', shipmentIds: [], manifestIds: [] }] }) },
  },
}));
function show(path) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[`/admin/${path}`]}><MiddleMilePage /></MemoryRouter></QueryClientProvider>);
}
describe('Middle Mile document flow', () => {
  it('saves city and PIN-code sorting separately from loading tally creation', async () => {
    show('segregations');
    await screen.findByRole('option', { name: /Mumbai/ });
    await userEvent.selectOptions(screen.getByLabelText('Destination city'), 'Mumbai');
    await userEvent.type(screen.getByLabelText('Destination PIN code (optional)'), '400001');
    await userEvent.click(await screen.findByLabelText('Select LR001'));
    await userEvent.click(screen.getByRole('button', { name: 'Save Sorting' }));
    await waitFor(() => expect(middleMileApi.sort).toHaveBeenCalledWith({ destination: 'Mumbai', destinationPincode: '400001', shipmentIds: ['lr'] }));
    expect(screen.queryByText(/Hub Inward/)).not.toBeInTheDocument();
  });
  it('requires LR verification before creating the manifest', async () => {
    show('manifests');
    await screen.findByRole('option', { name: /LT001/ });
    await userEvent.selectOptions(screen.getByLabelText('Loading tally'), 'tally');
    const checkbox = await screen.findByLabelText('Verify LR001');
    expect(screen.getByRole('button', { name: 'Create Manifest' })).toBeDisabled();
    await userEvent.click(checkbox);
    await userEvent.click(screen.getByRole('button', { name: 'Create Manifest' }));
    await waitFor(() => expect(middleMileApi.manifests.create).toHaveBeenCalledWith({ loadingTallyId: 'tally', verifiedShipmentIds: ['lr'] }));
  });
  it('offers print for a newly created planned trip', async () => {
    show('trips');
    await userEvent.click(await screen.findByRole('button', { name: 'Print Trip' }));
    expect(await screen.findByText('TRIP SHEET')).toBeInTheDocument();
    expect(screen.getAllByText('SEAL001').length).toBeGreaterThan(0);
    expect(screen.queryByText('Verify & Inward')).not.toBeInTheDocument();
  });
});

it('creates tally from saved sorting with loading details, then displays the selected LRs and prints', async () => {
  show('loading-tallies');
  await userEvent.click(screen.getByRole('button', { name: 'Create Loading Tally' }));
  await userEvent.selectOptions(await screen.findByLabelText('Destination city'), 'Mumbai');
  expect(await screen.findByText('LR001')).toBeInTheDocument();
  await userEvent.type(screen.getByLabelText('Loading bay'), 'Bay 2');
  await userEvent.type(screen.getByLabelText('Vehicle type'), 'Truck');
  await userEvent.type(screen.getByLabelText('Capacity (kg)'), '1000');
  await userEvent.click(screen.getByRole('button', { name: 'Create Tally' }));
  await waitFor(() => expect(middleMileApi.tallies.create).toHaveBeenCalledWith({ segregationId: 'sorting', loadingBay: 'Bay 2', vehicleType: 'Truck', vehicleCapacityKg: 1000 }, expect.anything()));
  expect(await screen.findByText('LOADING TALLY')).toBeInTheDocument();
  expect(screen.getByText('LR001')).toBeInTheDocument();
  const print = vi.spyOn(window, 'print').mockImplementation(() => {});
  await userEvent.click(screen.getAllByRole('button', { name: 'Print Tally' }).at(-1));
  expect(print).toHaveBeenCalledOnce();
  print.mockRestore();
});

it('assigns the selected route when creating a trip from a city manifest', async () => {
  show('trips');
  await userEvent.click(screen.getByRole('button', { name: 'Create Trip' }));
  await userEvent.selectOptions(await screen.findByLabelText('Vehicle Source'), 'MV');
  await userEvent.type(screen.getByLabelText('Vehicle Number'), 'MH31AB1234');
  await userEvent.type(screen.getByLabelText('Driver Name'), 'Driver');
  await userEvent.type(screen.getByLabelText('Trip cost (required for MV)'), '100');
  await screen.findByRole('option', { name: 'Mumbai' });
  await userEvent.selectOptions(screen.getByLabelText('Destination'), 'Mumbai');
  await screen.findByRole('option', { name: /Nagpur Mumbai/ });
  await userEvent.selectOptions(screen.getByLabelText('Route *'), 'route');
  await userEvent.selectOptions(screen.getByLabelText('Manifest number'), 'manifest');
  await userEvent.type(screen.getByLabelText('Seal number'), 'SEAL001');
  const departure = screen.getByLabelText('Departure date');
  const { fireEvent } = await import('@testing-library/react');
  fireEvent.change(departure, { target: { value: '2026-10-06T10:00' } });
  await userEvent.click(screen.getAllByRole('button', { name: 'Create Trip' }).at(-1));
  await waitFor(() => expect(middleMileApi.trips.create).toHaveBeenCalledWith(expect.objectContaining({ routeId: 'route', destination: 'Mumbai', manifestIds: ['manifest'] }), expect.anything()));
});
