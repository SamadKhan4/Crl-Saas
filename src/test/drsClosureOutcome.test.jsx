import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DrsWorkspacePage from '../pages/DrsWorkspacePage';
import { lastMileApi } from '../api/services';

const state = vi.hoisted(() => ({ drs: null }));
vi.mock('../api/services', () => ({ lastMileApi: {
  drs: { detail: vi.fn(async () => ({ data: state.drs })) },
  attempt: vi.fn(async (_id, _lr, body) => { state.drs = { ...state.drs, items: [{ shipmentId: 'lr', attemptStatus: body.outcome, failureReason: body.failureReason }] }; return { data: state.drs }; }),
} }));
vi.mock('../features/auth/AuthContext', () => ({ useAuth: () => ({ user: { role: 'ADMIN' } }) }));
beforeEach(() => {
  vi.clearAllMocks();
  state.drs = { _id: 'drs', drsNumber: 'DRS001', status: 'OPEN', shipmentIds: [{ _id: 'lr', lrNumber: 'LR001', receiverName: 'Receiver' }], items: [{ shipmentId: 'lr', attemptStatus: 'PENDING' }], podShipmentIds: [] };
});
function mount() {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={[{ pathname: '/admin/drs/drs', state: { from: 'closure' } }]}><Routes><Route path="/admin/drs/:id" element={<DrsWorkspacePage />} /></Routes></MemoryRouter></QueryClientProvider>);
}

it('asks for a mandatory reason only when Undelivered is selected', async () => {
  mount();
  const dropdown = await screen.findByRole('combobox', { name: 'Delivery status for LR001' });
  expect(screen.queryByLabelText('Undelivered reason for LR001')).not.toBeInTheDocument();
  await userEvent.selectOptions(dropdown, 'UNDELIVERED');
  expect(screen.getByRole('button', { name: 'Save status' })).toBeDisabled();
  await userEvent.type(screen.getByLabelText('Undelivered reason for LR001'), 'Receiver unavailable');
  await userEvent.click(screen.getByRole('button', { name: 'Save status' }));
  await waitFor(() => expect(lastMileApi.attempt).toHaveBeenCalledWith('drs', 'lr', expect.objectContaining({ outcome: 'UNDELIVERED', failureReason: 'Receiver unavailable' })));
  expect(await screen.findByText('Receiver unavailable')).toBeInTheDocument();
});

it('shows the POD file picker after Delivered and keeps the document preview out of closure', async () => {
  mount();
  await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Delivery status for LR001' }), 'DELIVERED');
  await userEvent.click(screen.getByRole('button', { name: 'Save status' }));
  const picker = await screen.findByLabelText('Choose POD file for LR001');
  const file = new File(['image'], 'pod.jpg', { type: 'image/jpeg' });
  await userEvent.upload(picker, file);
  expect(picker.files[0]).toBe(file);
  expect(screen.queryByText('DELIVERY RUN SHEET')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Upload POD' })).toBeDisabled();
  await userEvent.type(screen.getByLabelText('Receiver name for LR001'), 'Actual Receiver');
  expect(screen.getByRole('button', { name: 'Upload POD' })).toBeEnabled();
});
