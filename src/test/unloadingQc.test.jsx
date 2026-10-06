import { it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LastMilePage from '../pages/LastMilePage';
import { lastMileApi } from '../api/services';

const state = vi.hoisted(() => ({ tally: null }));
vi.mock('../api/services', () => ({
  lastMileApi: {
    tallies: { list: vi.fn(async () => ({ data: [state.tally] })) },
    completeTally: vi.fn(async () => { state.tally = { ...state.tally, status: 'QC_PENDING' }; return { data: state.tally }; }),
    updateQc: vi.fn(async (_id, _shipment, body) => {
      state.tally = { ...state.tally, status: 'READY_FOR_INWARD', items: state.tally.items.map((item) => ({ ...item, ...body })) };
      return { data: state.tally };
    }),
  },
  usersApi: {},
}));
it('completes unloading and processes QC in the same open tally window', async () => {
  state.tally = { _id: 'tally', tallyNumber: 'UT001', status: 'UNLOADING', totalLrs: 1, totalPackages: 1, scannedPackages: 1,
    items: [{ shipmentId: { _id: 'lr', lrNumber: 'LR001' }, expectedPackages: 1, receivedPackages: 1, qcStatus: 'PENDING' }] };
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={cache}><MemoryRouter initialEntries={['/admin/unloading-tallies']}><LastMilePage /></MemoryRouter></QueryClientProvider>);
  await userEvent.click(await screen.findByRole('button', { name: 'Open Tally' }));
  await userEvent.click(screen.getByRole('button', { name: 'Complete Unloading' }));
  await screen.findByRole('button', { name: 'Save QC' });
  expect(screen.queryByRole('button', { name: 'Scan Package' })).not.toBeInTheDocument();
  expect(screen.getByRole('dialog')).toHaveAccessibleName('UT001 - QC / DEPS');
  await userEvent.selectOptions(screen.getByRole('combobox'), 'PASSED');
  await userEvent.type(screen.getByPlaceholderText('Bay / rack'), 'Rack A');
  await userEvent.click(screen.getByRole('button', { name: 'Save QC' }));
  await waitFor(() => expect(lastMileApi.updateQc).toHaveBeenCalledWith('tally', 'lr', expect.objectContaining({ qcStatus: 'PASSED', storageLocation: 'Rack A' })));
  expect(lastMileApi.completeTally).toHaveBeenCalledWith('tally', expect.any(Array));
});
