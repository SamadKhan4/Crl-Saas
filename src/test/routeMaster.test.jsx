import { it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RouteMasterPage from '../pages/RouteMasterPage';
import { masterDataApi } from '../api/services';
import { serviceLocationNames } from '../data/serviceLocations';
vi.mock('../api/services', () => ({
  masterOptionsApi: { list: async () => ({ data: [{ city: 'Custom Yard' }] }) },
  masterDataApi: { list: async () => ({ data: [] }), create: vi.fn(async () => ({ data: {} })) },
}));
it('suggests every LR destination and accepts a manual city, stop and distance without office fields', async () => {
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const { container } = render(<QueryClientProvider client={cache}><RouteMasterPage /></QueryClientProvider>);
  await screen.findByLabelText('Route name');
  const suggestions = [...container.querySelectorAll('datalist option')].map((option) => option.value);
  for (const city of serviceLocationNames) expect(suggestions).toContain(city);
  expect(suggestions).toContain('Custom Yard');
  await userEvent.type(screen.getByLabelText('Route name'), 'Manual city route');
  await userEvent.type(screen.getByLabelText('Destination location / city'), 'New Industrial Estate');
  await userEvent.type(screen.getByLabelText('Distance (km)'), '124.5');
  await userEvent.click(screen.getByRole('button', { name: 'Add intermediate city' }));
  await userEvent.type(screen.getByLabelText('Stop 1'), 'Small Village');
  await userEvent.click(screen.getByRole('button', { name: 'Create Route' }));
  await waitFor(() => expect(masterDataApi.create).toHaveBeenCalledWith({ type: 'ROUTE', name: 'Manual city route', origin: 'Nagpur', destination: 'New Industrial Estate', intermediateHubs: ['Small Village'], distanceKm: 124.5 }, expect.anything()));
  expect(screen.queryByLabelText(/branch/i)).not.toBeInTheDocument();
});
