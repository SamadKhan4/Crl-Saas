import { it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LastMilePage from '../pages/LastMilePage';
import { lastMileApi, middleMileApi } from '../api/services';

const state = vi.hoisted(() => ({ tally: null, trips: [], manifests: [] }));
vi.mock('../api/services', () => ({
  lastMileApi: {
    arrivals: vi.fn(async () => ({ data: [] })),
    tallies: { list: vi.fn(async () => ({ data: [state.tally] })), detail: vi.fn(async () => ({ data: state.tally })) },
    drsManifests: vi.fn(async () => ({ data: state.manifests })),
    drs: { list: vi.fn(async () => ({ data: [] })), create: vi.fn(async () => ({ data: {} })) },
    finalizeDrs: vi.fn(),
    dispatchDrs: vi.fn(),
    completeTally: vi.fn(async () => { state.tally = { ...state.tally, status: 'QC_PENDING' }; return { data: state.tally }; }),
    updateQc: vi.fn(async (_id, _shipment, body) => {
      state.tally = { ...state.tally, status: 'READY_FOR_INWARD', items: state.tally.items.map((item) => ({ ...item, ...body })) };
      return { data: state.tally };
    }),
    inward: vi.fn(async () => ({ data: { ...state.tally, status: 'INWARDED' } })),
  },
  middleMileApi: {
    trips: { list: vi.fn(async () => ({ data: state.trips })) },
    arriveTrip: vi.fn(async () => { state.trips = []; return { data: {} }; }),
  },
  usersApi: { list: vi.fn(async () => ({ data: [] })) },
  vendorOptionsApi: { list: vi.fn(async () => ({ data: [{ _id: 'vendor', vendorCode: 'V001', name: 'Delivery Vendor' }] })) },
  masterOptionsApi: { list: vi.fn(async () => ({ data: [{ _id: 'route', code: 'R001', name: 'Mumbai Local' }] })) },
}));
vi.mock('../features/auth/AuthContext', () => ({ useAuth: () => ({ user: { role: 'ADMIN' } }) }));
it('closes the trip and processes QC in the same Last Mile tab', async () => {
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
  await screen.findByRole('button', { name: 'Save QC' });
  expect(screen.queryByRole('button', { name: 'Scan Package' })).not.toBeInTheDocument();
  expect(screen.getByRole('dialog')).toHaveAccessibleName('TRIP001 - QC / DEPS');
  await userEvent.selectOptions(screen.getByRole('combobox'), 'PASSED');
  await userEvent.type(screen.getByPlaceholderText('Bay / rack'), 'Rack A');
  await userEvent.click(screen.getByRole('button', { name: 'Save QC' }));
  await waitFor(() => expect(lastMileApi.updateQc).toHaveBeenCalledWith('tally', 'lr', expect.objectContaining({ qcStatus: 'PASSED', storageLocation: 'Rack A' })));
  const submitQc = await screen.findByRole('button', { name: 'Submit QC' });
  await waitFor(() => expect(submitQc).toBeEnabled());
  await userEvent.click(submitQc);
  await waitFor(() => expect(lastMileApi.inward).toHaveBeenCalledWith('tally', undefined));
});

it('marks a dispatched trip arrived in the first Last Mile tab', async () => {
  state.trips = [{ _id: 'trip', tripNumber: 'TRIP001', vehicleNumber: 'MH31AB1234', driverName: 'Driver', origin: 'Nagpur', destination: 'Mumbai', shipmentIds: [], totalPackages: 1, workflowStatus: 'IN_TRANSIT' }];
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={['/admin/last-mile-arrivals']}><LastMilePage /></MemoryRouter></QueryClientProvider>);
  await userEvent.click(await screen.findByRole('button', { name: 'Mark Arrived' }));
  await waitFor(() => expect(middleMileApi.arriveTrip).toHaveBeenCalledWith('trip'));
});

it('creates a DRS from an eligible manifest and fetches its delivery information', async () => {
  state.manifests = [{
    _id: 'manifest', manifestNumber: 'MNF001', origin: 'Nagpur', destination: 'Mumbai', status: 'CLOSED',
    vendorId: { _id: 'vendor', vendorCode: 'V001', name: 'Delivery Vendor' },
    routeId: { _id: 'route', name: 'Mumbai Local' },
    tripId: { vehicleNumber: 'MH31AB1234', driverName: 'Manifest Driver', driverMobile: '9876543210' },
    shipmentIds: [{ _id: 'lr', lrNumber: 'LR001', senderName: 'Consignor', receiverName: 'Consignee', receiverMobile: '9988776655', packageCount: 3, weightKg: 60, lrDetails: { consigneeAddress: 'Andheri', codCharges: 500 } }],
  }];
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={cache}><MemoryRouter initialEntries={['/admin/drs-preparation']}><LastMilePage /></MemoryRouter></QueryClientProvider>);
  await userEvent.click(await screen.findByRole('button', { name: 'Create DRS' }));
  await userEvent.selectOptions(await screen.findByLabelText('Delivery Manifest *'), 'manifest');
  expect(await screen.findByText('LR001')).toBeInTheDocument();
  expect(screen.getByDisplayValue('MH31AB1234')).toBeInTheDocument();
  expect(screen.getByDisplayValue('Manifest Driver')).toBeInTheDocument();
  expect(screen.getByLabelText('DRS vendor from PRS')).toHaveValue('V001 · Delivery Vendor');
  const createButtons = screen.getAllByRole('button', { name: 'Create DRS' });
  await userEvent.click(createButtons.at(-1));
  await waitFor(() => expect(lastMileApi.drs.create).toHaveBeenCalledWith(expect.objectContaining({ manifestId: 'manifest', shipmentIds: ['lr'], vehicleNumber: 'MH31AB1234', driverName: 'Manifest Driver', route: 'Mumbai Local' })));
});
