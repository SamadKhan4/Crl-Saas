import { it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LoadingScanModal from '../components/tms/LoadingScanModal';
import { middleMileApi } from '../api/services';

vi.mock('../api/services', () => ({ middleMileApi: { tallies: { detail: vi.fn() }, scanTally: vi.fn() } }));

it('shows package barcodes and keeps invalid input with an inline error, then updates successful scans', async () => {
  const tally = { _id: 'tally', tallyNumber: 'LT001', totalLrs: 1, totalPackages: 1, items: [{ scannedBarcodes: [] }], packages: [{ barcode: 'LR001-01OF1' }] };
  middleMileApi.tallies.detail.mockResolvedValue({ data: tally });
  middleMileApi.scanTally.mockRejectedValueOnce(new Error('Package barcode not found')).mockImplementationOnce(async () => {
    middleMileApi.tallies.detail.mockResolvedValue({ data: { ...tally, items: [{ scannedBarcodes: ['LR001-01OF1'] }] } });
  });
  const refreshed = vi.fn();
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><LoadingScanModal tally={tally} onClose={() => {}} onScanned={refreshed} /></QueryClientProvider>);
  expect(await screen.findByText('LR001-01OF1')).toBeInTheDocument();
  const input = screen.getByRole('textbox');
  await userEvent.type(input, 'LR001');
  await userEvent.click(screen.getByRole('button', { name: 'Scan Package' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Package barcode not found');
  expect(input).toHaveValue('LR001');
  await userEvent.clear(input);
  await userEvent.type(input, 'LR001-01OF1');
  await userEvent.click(screen.getByRole('button', { name: 'Scan Package' }));
  expect(await screen.findByText(/— Scanned/)).toBeInTheDocument();
  expect(input).toHaveValue('');
  expect(refreshed).toHaveBeenCalled();
});
