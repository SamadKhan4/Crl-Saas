import { expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import UnloadingTallyDocument, { UnloadingTallySheet } from '../components/tms/UnloadingTallyDocument';
import { tripsApi } from '../api/services';

vi.mock('../api/services', () => ({ tripsApi: { detail: vi.fn() } }));
const lr = { _id: 'lr', lrNumber: 'LR001', packageCount: 26, senderName: 'Sender', receiverName: 'Receiver', weightKg: 100, lrDetails: { goods: [{ description: 'Machine parts', packageNumber: '1-26', quantity: 26, packageType: 'Carton' }] } };
const trip = { _id: 'trip', tripNumber: 'TRIP001', origin: 'Nagpur', destination: 'Yavatmal', toHubId: { name: 'Destination Branch' }, vehicleNumber: 'MH31AB1234', driverName: 'Driver', driverMobile: '9876543210', vendorId: { vendorCode: 'V001', name: 'Transport Vendor', mobile: '9988776655', gstNumber: 'GST001' }, shipmentIds: [lr], manifestIds: [{ _id: 'manifest', manifestNumber: 'MNF001', shipmentIds: [lr] }] };

it('shows trip, vendor, manifest and LR goods with physical verification columns', () => {
  render(<UnloadingTallySheet trip={trip} />);
  expect(screen.getByText('TRIP001')).toBeInTheDocument();
  expect(screen.getByText(/Manifest: MNF001/)).toBeInTheDocument();
  expect(screen.getByText('LR001')).toBeInTheDocument();
  expect(screen.getByText(/Transport Vendor \/ V001/)).toBeInTheDocument();
  expect(screen.getByText(/Machine parts.*26 packages/)).toBeInTheDocument();
  expect(screen.getByRole('columnheader', { name: 'Remarks / condition' })).toBeInTheDocument();
  expect(screen.getByRole('columnheader', { name: 'Verified / sign' })).toBeInTheDocument();
  expect(screen.getByText('Verified / received by')).toBeInTheDocument();
});

it('loads complete trip details for preview and prints the unloading sheet', async () => {
  tripsApi.detail.mockResolvedValue({ data: trip });
  const print = vi.spyOn(window, 'print').mockImplementation(() => {});
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><UnloadingTallyDocument tripId="trip" onClose={() => {}} /></QueryClientProvider>);
  await screen.findByText('TRIP001');
  expect(tripsApi.detail).toHaveBeenCalledWith('trip');
  await userEvent.click(screen.getByRole('button', { name: 'Print Unloading Tally' }));
  expect(print).toHaveBeenCalledOnce();
  print.mockRestore();
});
