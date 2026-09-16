import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { get, errorMessage } from '../../api/client';
import { idOf } from '../../lib/workflow';

export default function CustomerCodeLookup({ value, onChange, onCustomer }) {
  const [code, setCode] = useState('');
  const query = useQuery({
    queryKey: ['customers', 'code', code],
    queryFn: () => get(`/customers/code/${code}`),
    enabled: /^\d{5}$/.test(code),
    retry: false,
  });

  useEffect(() => {
    const customer = query.data?.data;
    if (customer) {
      onChange(idOf(customer));
      onCustomer(customer);
    }
  }, [query.data, onChange, onCustomer]);

  function change(event) {
    const next = event.target.value.replace(/\D/g, '').slice(0, 5);
    setCode(next);
    if (value) {
      onChange('');
      onCustomer(null);
    }
  }

  return (
    <div className="field">
      <label htmlFor="customerCode">Customer code</label>
      <input id="customerCode" inputMode="numeric" pattern="\d{5}" maxLength={5} placeholder="5-digit code" value={code} onChange={change} />
      {query.isFetching && <small>Fetching customer…</small>}
      {query.data?.data && <small>{query.data.data.name} · {query.data.data.customerType === 'CREDIT' ? 'Credit' : 'To Pay / Paid'}</small>}
      {query.isError && <small className="field-error" role="alert">{errorMessage(query.error)}</small>}
    </div>
  );
}
