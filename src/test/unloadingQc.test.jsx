import { it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LastMilePage from '../pages/LastMilePage';
import { lastMileApi, middleMileApi } from '../api/services';

const state = vi.hoisted(() => ({ tally: null, trips: [], manifests: [], inventory: [] }));
vi.mock('../api/services', () => ({
  lastMileApi: {
    arrivals: vi.fn(async () => ({ data: [] })),
    tallies: { list: vi.fn(async () => ({ data: [state.tally] })), detail: vi.fn(async () => ({ data: state.tally })) },
    inventory: vi.fn(async () => ({ data: state.inventory })),
    drsManifests: vi.fn(async () => ({ data: state.manifests })),
    drs: { list: vi.fn(async () => ({ data: [] })), create: vi.fn(async () => ({ data: {} })) },
    finalizeDrs: vi.fn(),
    dispatchDrs: vi.fn(),
    completeTally: vi.fn(async () => { state.tally = { ...state.tally, status: 'INWARDED' }; return { data: state.tally }; }),
    updateQc: vi.fn(async (_id, _shipment, body) => {
      state.tally = { ...state.tally, status: 'READY_FOR_INWARD', items: state.tally.items.map((item) => ({ ...item, ...body })) };
      return { data: state.tally };
    }),
    inward: vi.fn(async () => ({ data: { ...state.tally, status: 'INWARDED' } })),
  },
  tripsApi: { detail: vi.fn() },
  middleMileApi: {
    trips: { list: vi.fn(async () => ({ data: state.trips })) },
    arriveTrip: vi.fn(async () => { state.trips = state.trips.map((trip) => ({ ...trip, status: 'ARRIVED' })); return { data: {} }; }),
  },
  usersApi: { list: vi.fn(async () => ({ data: [] })) },
  vendorOptionsApi: { list: vi.fn(async () => ({ data: [{ _id: 'vendor', vendorCode: 'V001', name: 'Delivery Vendor', vendorType: 'LAST_MILE', vehicles: [{ vehicleNumber: 'MH31AB1111', driverName: 'First Driver', driverMobile: '9876543210', status: 'ACTIVE' }, { vehicleNumber: 'MH31AB1234', driverName: 'Local Driver', driverMobile: '9876543211', status: 'ACTIVE' }] }, { _id: 'other-vendor', name: 'Market Vendor', vendorType: 'MARKET' }] })) },
  branchOptionsApi: { list: vi.fn(async () => ({ data: [{ _id: 'branch', name: 'Mumbai Branch' }] })) },
  masterOptionsApi: { list: vi.fn(async () => ({ data: [{ _id: 'route', code: 'R001', name: 'Mumbai Local' }] })) },
}));
vi.mock('../features/auth/AuthContext', () => ({ useAuth: () => ({ user: { role: 'ADMIN' } }) }));
it('closes the trip and makes verified LRs available without a QC step', async () => {
  state.tally = { _id: 'tally', tallyNumber: 'UT001', status: 'UNLOADING', totalLrs: 1, totalPackages: 1, scannedPackages: 1,
    tripId: { tripNumber: 'TRIP001', manifestIds: [{ _id: 'manifest', manifestNumber: 'MNF001', totalLrs: 1, totalPackages: 1, shipmentIds: [{ _id: 'lr', lrNumber: 'LR001' }] }] },
    items: [{ shipmentId: { _id: 'lr', lrNumber: 'LR001' }, expectedPackages: 1, receivedPackages: 1, qcStatus: 'PENDING' }] };
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={cache}><MemoryRouter initialEntries={['/admin/unloading-tallies']}><LastMilePage /></MemoryRouter></QueryClientProvider>);
  await userEvent.click(await screen.findByRole('button', { name: 'View' }));
  await userEvent.click(await screen.findByText('MNF001'));
  expect(screen.queryByLabelText('Package Barcode')).not.toBeInTheDocument();
  await userEvent.type(screen.getByRole('textbox', { name: 'Remark for LR001' }), 'All boxes received');
  await userEvent.click(screen.getByRole('checkbox', { name: 'Verified' }));
  await userEvent.click(screen.getByRole('button', { name: 'Close Trip' }));
  expect(lastMileApi.completeTally).toHaveBeenCalledWith('tally', [expect.objectContaining({ shipmentId: 'lr', receivedPackages: 1, receiptRemarks: 'All boxes received' })]);
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(lastMileApi.updateQc).not.toHaveBeenCalled();

});

it('marks a dispatched trip arrived in the first Last Mile tab', async () => {
  state.trips = [{ _id: 'trip', tripNumber: 'TRIP001', vehicleNumber: 'MH31AB1234', driverName: 'Driver', origin: 'Nagpur', destination: 'Mumbai', shipmentIds: [], totalPackages: 1, status: 'DISPATCHED', workflowStatus: 'IN_TRANSIT' }];
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={['/admin/last-mile-arrivals']}><LastMilePage /></MemoryRouter></QueryClientProvider>);
  await userEvent.click(await screen.findByRole('button', { name: 'Mark Arrived' }));
  await waitFor(() => expect(middleMileApi.arriveTrip).toHaveBeenCalledWith('trip'));
  expect(await screen.findByRole('button', { name: 'Arrived' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'View' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Print Unloading Tally' })).toBeInTheDocument();
});

it('creates an independent DRS using a matching vendor and searchable branch LRs', async () => {
  state.inventory = [{ _id: 'lr', lrNumber: 'LR001', receiverName: 'Consignee', packageCount: 3 }];
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={['/admin/drs-preparation']}><LastMilePage /></MemoryRouter></QueryClientProvider>);
  await userEvent.click(await screen.findByRole('button', { name: 'Create DRS' }));
  await userEvent.selectOptions(await screen.findByLabelText('Branch'), 'branch');
  await userEvent.selectOptions(screen.getByLabelText('Vendor type'), 'VV');
  await userEvent.selectOptions(screen.getByLabelText('Vendor'), 'vendor');
  expect(screen.queryByRole('option', { name: /Market Vendor/ })).not.toBeInTheDocument();
  await userEvent.type(screen.getByRole('combobox', { name: 'Undelivered LRs *' }), 'LR001');
  await userEvent.click(await screen.findByRole('option', { name: /LR001/ }));
  expect(screen.getByLabelText('Driver Name')).toHaveValue('First Driver');
  await userEvent.selectOptions(screen.getByLabelText('Vehicle Number'), 'MH31AB1234');
  expect(screen.getByLabelText('Driver Name')).toHaveValue('Local Driver');
  expect(screen.getByLabelText('Driver Mobile')).toHaveValue('9876543211');
  expect(screen.queryByLabelText('Route')).not.toBeInTheDocument();
  expect(screen.queryByText('Delivery Agent')).not.toBeInTheDocument();
  await userEvent.click(screen.getAllByRole('button', { name: 'Create DRS' }).at(-1));
  await waitFor(() => expect(lastMileApi.drs.create).toHaveBeenCalledWith(expect.objectContaining({ branchId: 'branch', vehicleSource: 'VV', vendorId: 'vendor', shipmentIds: ['lr'], vehicleNumber: 'MH31AB1234', driverName: 'Local Driver' })));
  expect(lastMileApi.drs.create.mock.calls.at(-1)[0]).not.toHaveProperty('manifestId');
});


it('opens the POD closure checklist directly for new runs and existing drafts', async () => {
  lastMileApi.drs.list.mockResolvedValueOnce({ data: [
    { _id: 'new-run', drsNumber: 'DRS002', status: 'OPEN', workflowStatus: 'DISPATCHED', shipmentIds: [] },
    { _id: 'old-draft', drsNumber: 'DRS001', status: 'OPEN', workflowStatus: 'DRAFT', shipmentIds: [] },
  ] });
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={['/admin/drs-preparation']}><LastMilePage /></MemoryRouter></QueryClientProvider>);
  const links = await screen.findAllByRole('link', { name: 'POD Closure Checklist' });
  expect(links).toHaveLength(2);
  expect(links[0]).toHaveAttribute('href', '/admin/drs/new-run');
  expect(screen.queryByRole('button', { name: 'Finalize' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Dispatch', exact: true })).not.toBeInTheDocument();
});
