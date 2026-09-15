import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DestinationLookup from '../components/forms/DestinationLookup';
import { get } from '../api/client';

vi.mock('../api/client', () => ({ get: vi.fn(), errorMessage: () => 'Unable to load' }));
beforeEach(() => vi.resetAllMocks());

it('finds and selects a Vidarbha area by PIN', async () => {
  const place = { id: '440001:Nagpur GPO', name: 'Nagpur GPO', district: 'Nagpur', pincode: '440001' };
  get.mockResolvedValue({ data: [place] });
  const onChange = vi.fn(), user = userEvent.setup();
  render(<QueryClientProvider client={new QueryClient()}><DestinationLookup label="To" onChange={onChange} /></QueryClientProvider>);
  await user.type(screen.getByLabelText('Search To'), '440001');
  await waitFor(() => expect(get).toHaveBeenCalledWith('/destinations', { search: '440001' }));
  await screen.findByRole('option', { name: 'Nagpur GPO, Nagpur - 440001' });
  await user.selectOptions(screen.getByRole('combobox', { name: 'To' }), place.id);
  expect(onChange).toHaveBeenCalledWith(place);
});

it('shows only three dropdown values', async () => {
  get.mockResolvedValue({ data: Array.from({ length: 5 }, (_, index) => ({ id: String(index), name: `Area ${index}`, district: 'Nagpur', pincode: `44000${index}` })) });
  render(<QueryClientProvider client={new QueryClient()}><DestinationLookup label="From" onChange={() => {}} /></QueryClientProvider>);
  await screen.findByRole('option', { name: 'Area 0, Nagpur - 440000' });
  expect(screen.getAllByRole('option')).toHaveLength(4);
});
