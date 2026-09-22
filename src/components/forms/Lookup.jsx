import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { get, errorMessage } from '../../api/client';
import { useDebounce } from '../../hooks/useList';
import { idOf } from '../../lib/workflow';

export default function Lookup({
  resource,
  value,
  onChange,
  label,
  ownBranch,
  branchOptions = false,
  activeOnly = true,
  customerType,
}) {
  const [search, setSearch] = useState('');
  const term = useDebounce(search);
  const query = useQuery({
    queryKey: [resource, 'lookup', term, branchOptions, activeOnly],
    queryFn: () =>
      branchOptions
        ? get('/branches/options')
        : resource === 'vendors'
          ? get('/vendors/options', { search: term, limit: 100 })
        : resource === 'segregations'
          ? get('/segregations/options', { search: term, limit: 100 })
        : get(`/${resource}`, {
            search: term,
            ...(activeOnly && { status: 'ACTIVE' }),
            limit: 100,
          }),
  });
  return (
    <div className="field">
      <label>
        {label}
        <input
          aria-label={`Search ${label}`}
          placeholder={`Search ${label.toLowerCase()}…`}
          value={search}
          maxLength={100}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select
          aria-label={label}
          value={value || ''}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">Select {label.toLowerCase()}</option>
          {value && !(query.data?.data || []).some((item) => idOf(item) === value) && (
            <option value={value}>{value}</option>
          )}
          {(query.data?.data || [])
            .filter(
              (item) =>
                (!customerType || item.customerType === customerType) &&
                (!ownBranch || idOf(item) === ownBranch) &&
                (!branchOptions ||
                  `${item.branchCode} ${item.name} ${item.city} ${item.pincode || ''} ${item.address || ''}`
                    .toLowerCase()
                    .includes(term.toLowerCase())),
            )
            .map((item) => {
              const rawCode =
                item.customerCode ||
                item.branchCode ||
                item.vendorCode ||
                item.segregationNumber ||
                item.invoiceNumber ||
                item.lrNumber;
              const rawName =
                item.name || item.leadName || item.receivedFrom || item.destination || item.driverName || 'Record';
              const code = typeof rawCode === 'string' || typeof rawCode === 'number' ? rawCode : '';
              const name = typeof rawName === 'string' || typeof rawName === 'number'
                ? rawName
                : rawName?.name || rawName?.city || rawName?.branchCode || 'Record';
              return (
                <option key={idOf(item)} value={idOf(item)}>
                  {code ? `${code} · ` : ''}
                  {name}
                  {item.pincode ? ` - ${item.pincode}` : ''}
                </option>
              );
            })}
        </select>
      </label>
      {query.isPending && <small>Loading choices…</small>}
      {query.isError && (
        <small role="alert" className="field-error">
          {errorMessage(query.error)}
        </small>
      )}
    </div>
  );
}
