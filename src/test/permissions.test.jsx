import { it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PermissionsPage from '../pages/PermissionsPage';
import { api } from '../api/client';

vi.mock('../api/client', () => ({
  api: { patch: vi.fn(async () => ({ data: { success: true } })) },
  checkEnvelope: (value) => value,
  errorMessage: (error) => error.message,
}));
vi.mock('../api/services', () => ({
  usersApi: {
    list: vi.fn(async () => ({
      data: [
        { id: 'employee-1', name: 'Test Employee', branchId: { _id: 'branch-1', name: 'Nagpur' } },
      ],
    })),
  },
}));
vi.mock('../components/forms/Lookup', () => ({
  default: ({ label, value, onChange }) => (
    <label>
      {label}
      <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Choose</option>
        <option value="branch-1">Nagpur</option>
        <option value="branch-2">Pune</option>
      </select>
    </label>
  ),
}));

it('defaults operation permissions to selected and saves only the chosen stage modules and branch', async () => {
  const user = userEvent.setup();
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <PermissionsPage />
    </QueryClientProvider>,
  );
  await user.click(await screen.findByRole('button', { name: 'Configure', exact: true }));
  expect(screen.getByRole('checkbox', { name: 'MANIFEST VIEW' })).toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'PICKUP ADD' })).toBeChecked();
  await user.click(screen.getByRole('checkbox', { name: /First Mile/ }));
  await user.click(screen.getByRole('checkbox', { name: /Last Mile/ }));
  expect(screen.queryByRole('checkbox', { name: 'PICKUP ADD' })).not.toBeInTheDocument();
  expect(screen.queryByRole('checkbox', { name: 'POD VIEW' })).not.toBeInTheDocument();
  expect(screen.getByRole('checkbox', { name: 'MANIFEST VIEW' })).toBeChecked();
  await user.click(screen.getByRole('checkbox', { name: 'MANIFEST DELETE' }));
  await user.selectOptions(screen.getByRole('combobox', { name: 'Assigned branch' }), 'branch-2');
  await user.click(screen.getByRole('button', { name: 'Save permissions' }));
  await waitFor(() => expect(api.patch).toHaveBeenCalled());
  const [url, body] = api.patch.mock.calls[0];
  expect(url).toBe('/users/employee-1/operation-access');
  expect(body.branchId).toBe('branch-2');
  expect(body.operationStages).toEqual(['MM']);
  expect(body.permissions.map((item) => item.module)).toEqual([
    'LR',
    'HUB',
    'SORTING',
    'MANIFEST',
    'LOADING',
    'PTL',
    'FTL',
    'TRIP',
  ]);
  expect(body.permissions.find((item) => item.module === 'MANIFEST').actions).not.toContain(
    'DELETE',
  );
});
