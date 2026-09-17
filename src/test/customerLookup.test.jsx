import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { api } from '../api/client';
import CustomerCodeLookup from '../components/forms/CustomerCodeLookup';

const customers = Array.from({ length: 4 }, (_, index) => ({
  id: String(index + 1).repeat(24),
  customerCode: `1000${index + 1}`,
  name: `Customer ${index + 1}`,
  customerType: index === 0 ? 'CREDIT' : 'TO_PAY_PAID',
}));

afterEach(() => vi.restoreAllMocks());

it('searches customers by text, shows at most three choices and selects one', async () => {
  const request = vi.spyOn(api, 'get').mockResolvedValue({
    data: { success: true, data: customers, pagination: { page: 1, pages: 2, total: 4, limit: 3 } },
  });
  function Form() {
    const [value, setValue] = useState('');
    const [customer, setCustomer] = useState(null);
    return <>
      <CustomerCodeLookup value={value} onChange={setValue} onCustomer={setCustomer} />
      <span>{customer?.customerType}</span>
    </>;
  }
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><Form /></QueryClientProvider>);
  await userEvent.type(screen.getByRole('combobox'), 'Customer');
  await waitFor(() => expect(request).toHaveBeenCalledWith('/customers', {
    params: { search: 'Customer', status: 'ACTIVE', limit: 3 },
  }));
  expect(await screen.findAllByRole('option')).toHaveLength(3);
  await userEvent.click(screen.getAllByRole('option')[0]);
  expect(screen.getByRole('combobox')).toHaveValue('10001 · Customer 1');
  expect(screen.getByText('CREDIT')).toBeInTheDocument();
});
