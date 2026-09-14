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
}) {
  const [search, setSearch] = useState('');
  const term = useDebounce(search);
  const query = useQuery({
    queryKey: [resource, 'lookup', term, branchOptions],
    queryFn: () =>
      branchOptions
        ? get('/branches/options')
        : get(`/${resource}`, { search: term, status: 'ACTIVE', limit: 100 }),
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
          onChange={(e) => setSearch(e.target.value)}
        />
        <select aria-label={label} value={value || ''} onChange={(e) => onChange(e.target.value)}>
          <option value="">Select {label.toLowerCase()}</option>
          {value && !(query.data?.data || []).some((x) => idOf(x) === value) && (
            <option value={value}>{value}</option>
          )}
          {(query.data?.data || [])
            .filter(
              (x) =>
                (!ownBranch || idOf(x) === ownBranch) &&
                (!branchOptions ||
                  `${x.branchCode} ${x.name} ${x.city}`.toLowerCase().includes(term.toLowerCase())),
            )
            .map((x) => (
              <option key={idOf(x)} value={idOf(x)}>
                {x.customerCode || x.branchCode} · {x.name}
              </option>
            ))}
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
