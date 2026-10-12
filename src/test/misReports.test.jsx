import { beforeEach, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import GodownStockReportPage from '../pages/GodownStockReportPage';
import HubInTransitsReportPage from '../pages/HubInTransitsReportPage';
import DrsDetailsReportPage from '../pages/DrsDetailsReportPage';
import InvoiceDetailsReportPage from '../pages/InvoiceDetailsReportPage';
import BranchOutstandingReportPage from '../pages/BranchOutstandingReportPage';
import CustomerBusinessReportPage from '../pages/CustomerBusinessReportPage';
import BranchLoaReportPage from '../pages/BranchLoaReportPage';
import StockAgeingReportPage from '../pages/StockAgeingReportPage';
import UnbilledDetailsReportPage from '../pages/UnbilledDetailsReportPage';
import { get, download } from '../api/client';
vi.mock('../features/auth/AuthContext', () => ({ useAuth: () => ({ user: { role: 'ADMIN', id: 'admin' } }) }));
vi.mock('../api/client', () => ({ get: vi.fn(), download: vi.fn(async () => {}), api: { get: vi.fn() }, errorMessage: (error) => error.message }));
vi.mock('../components/forms/Lookup', () => ({ default: ({ label, onChange, value }) => <label>{label}<select value={value || ''} onChange={(event) => onChange(event.target.value)}><option value="">All</option><option value="aaaaaaaaaaaaaaaaaaaaaaaa">Test Office</option></select></label> }));
const payload = () => ({ data: [{ id: 'row1', shipmentId: 'shipment', lrNumber: 'LR-REAL-001', quantity: 2 }], columns: [{ key: 'lrNumber', label: 'LR Number' }, { key: 'quantity', label: 'Packages', type: 'number' }], metrics: { records: 'Records', quantity: 'Packages' }, summary: { records: 45, quantity: 90 }, pagination: { page: 1, limit: 20, total: 45, totalPages: 3 } });
beforeEach(() => { vi.clearAllMocks(); get.mockResolvedValue(payload()); });
const mount = (Page, entry = '/admin/reports/godown-stock') => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={[entry]}><Page /></MemoryRouter></QueryClientProvider>);
it.each([
  [GodownStockReportPage, 'godown-stock', 'Godown Stock'], [HubInTransitsReportPage, 'hub-in-transits', 'Hub-Hub In-Transits'], [DrsDetailsReportPage, 'drs-details', 'DRS Details'], [InvoiceDetailsReportPage, 'invoice-details', 'Invoice Details'], [BranchOutstandingReportPage, 'branch-outstanding', 'Branch Wise Outstanding'], [CustomerBusinessReportPage, 'customer-business', 'Customer Wise Business'], [BranchLoaReportPage, 'branch-loa', 'Branch Wise Letter of Authorization'], [StockAgeingReportPage, 'stock-ageing', 'Stock Ageing'], [UnbilledDetailsReportPage, 'unbilled-details', 'Unbilled Details'],
])('%s opens its dedicated backend report', async (Page, key, title) => {
  mount(Page, `/admin/reports/${key}`);
  expect(await screen.findByRole('heading', { name: title })).toBeInTheDocument();
  expect(await screen.findByText('LR-REAL-001')).toBeInTheDocument();
  expect(get).toHaveBeenCalledWith(`/reports/mis/${key}`, {});
  expect(screen.getByText('45')).toBeInTheDocument();
  expect(screen.getByText('90')).toBeInTheDocument();
});
it('keeps filters, summary, server pagination, sorting and export in sync', async () => {
  mount(GodownStockReportPage);
  await screen.findByText('LR-REAL-001');
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Branch / Godown' }), 'aaaaaaaaaaaaaaaaaaaaaaaa');
  await waitFor(() => expect(get).toHaveBeenLastCalledWith('/reports/mis/godown-stock', { branch: 'aaaaaaaaaaaaaaaaaaaaaaaa' }));
  await userEvent.type(screen.getByRole('textbox', { name: 'Search report records' }), 'LR-REAL');
  await waitFor(() => expect(get).toHaveBeenLastCalledWith('/reports/mis/godown-stock', expect.objectContaining({ search: 'LR-REAL' })));
  await userEvent.click(screen.getByRole('button', { name: 'LR Number' }));
  await waitFor(() => expect(get).toHaveBeenLastCalledWith('/reports/mis/godown-stock', expect.objectContaining({ sortBy: 'lrNumber', sortOrder: 'asc' })));
  await userEvent.click(screen.getByRole('button', { name: 'Next page' }));
  await waitFor(() => expect(get).toHaveBeenLastCalledWith('/reports/mis/godown-stock', expect.objectContaining({ page: '2' })));
  await userEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
  expect(download).toHaveBeenCalledWith(expect.stringContaining('branch=aaaaaaaaaaaaaaaaaaaaaaaa'), 'crl-godown-stock.csv');
  expect(download.mock.calls[0][0]).not.toContain('page=');
  await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
  await waitFor(() => expect(get).toHaveBeenLastCalledWith('/reports/mis/godown-stock', {}));
});
it('renders empty report and an actionable error without placeholder data', async () => {
  get.mockResolvedValueOnce({ ...payload(), data: [], summary: {}, pagination: { page: 1, total: 0, limit: 20, totalPages: 0 } });
  const view = mount(GodownStockReportPage);
  expect(await screen.findByText('No matching report records')).toBeInTheDocument();
  view.unmount(); get.mockRejectedValueOnce(new Error('Report unavailable'));
  mount(GodownStockReportPage);
  expect(await screen.findByText('Report unavailable')).toBeInTheDocument();
});
