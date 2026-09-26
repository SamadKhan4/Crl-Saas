import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { get, errorMessage } from '../../api/client';
import { useDebounce } from '../../hooks/useList';
import { idOf } from '../../lib/workflow';

export default function CustomerCodeLookup({ value, onChange, onCustomer, initialCustomer }) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const term = useDebounce(search.trim());
  const query = useQuery({
    queryKey: ['customers', 'lr-search', term],
    queryFn: () => get('/customers/lookup', { search: term, limit: 3 }),
    enabled: !selected && term.length > 0,
    retry: false,
  });
  const customers = (Array.isArray(query.data?.data) ? query.data.data : []).slice(0, 3);

  useEffect(() => {
    if (!value && selected) {
      setSelected(null);
      setSearch('');
      setOpen(false);
    }
  }, [selected, value]);

  useEffect(() => {
    if (!initialCustomer || selected || String(value || '') !== String(idOf(initialCustomer))) return;
    setSelected(initialCustomer);
    setSearch(`${initialCustomer.customerCode} · ${initialCustomer.name}`);
    setOpen(false);
    onCustomer(initialCustomer);
  }, [initialCustomer, onCustomer, selected, value]);

  function change(event) {
    const next = event.target.value.slice(0, 100);
    if (selected || value) {
      setSelected(null);
      onChange('');
      onCustomer(null);
    }
    setSearch(next);
    setActiveIndex(0);
    setOpen(Boolean(next.trim()));
  }

  function choose(customer) {
    setSelected(customer);
    setSearch(`${customer.customerCode} · ${customer.name}`);
    setOpen(false);
    onChange(idOf(customer));
    onCustomer(customer);
  }

  function keyDown(event) {
    if (!open || !customers.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % customers.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + customers.length) % customers.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      choose(customers[activeIndex]);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div
      className="field customer-lookup"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <label htmlFor="customerSearch">Search customer by name or code</label>
      <div className="customer-search-input">
        <Search size={16} aria-hidden="true" />
        <input
          id="customerSearch"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls="customer-suggestions"
          autoComplete="off"
          maxLength={100}
          placeholder="Type customer name or code"
          value={search}
          onChange={change}
          onFocus={() => !selected && search.trim() && setOpen(true)}
          onKeyDown={keyDown}
        />
      </div>
      {open && (
        <div id="customer-suggestions" className="customer-suggestions" role="listbox">
          {query.isFetching ? (
            <small>Searching customers…</small>
          ) : query.isError ? (
            <small className="field-error" role="alert">{errorMessage(query.error)}</small>
          ) : customers.length ? customers.map((customer, index) => (
            <button
              key={idOf(customer)}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              className={index === activeIndex ? 'active' : ''}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => choose(customer)}
            >
              <span><strong>{customer.name}</strong><small>{customer.customerCode}</small></span>
              <em>{customer.customerType === 'CREDIT' ? 'Credit' : 'To Pay / Paid'}</em>
            </button>
          )) : term ? (
            <small>No active customer found.</small>
          ) : null}
        </div>
      )}
      {selected && <small className="customer-selected">Selected: {selected.name} · {selected.customerCode}</small>}
    </div>
  );
}
