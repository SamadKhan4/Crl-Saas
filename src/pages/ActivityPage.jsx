import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import { get, errorMessage } from '../api/client';
import { PageHeader, DataTable, Loadingcrleleton, ErrorState } from '../components/common/UI';
import SearchInput from '../components/forms/SearchInput';
import { label } from '../lib/workflow';
import { dateRangeParams } from '../lib/filters';

export default function ActivityPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const filters = Object.fromEntries(
    [...params].filter(([key]) =>
      ['page', 'search', 'action', 'entityType', 'dateFrom', 'dateTo'].includes(key),
    ),
  );
  const query = useQuery({
    queryKey: ['activity', user.id, user.role, filters],
    queryFn: () => get('/activity', dateRangeParams(filters)),
    refetchInterval: 30000,
  });
  function update(key, value) {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      value ? next.set(key, String(value)) : next.delete(key);
      if (key !== 'page') next.delete('page');
      return next;
    });
  }
  const columns = [
    {
      key: 'createdAt',
      label: 'When',
      render: (row) => new Date(row.createdAt).toLocaleString('en-IN'),
    },
    {
      key: 'actor',
      label: 'Who',
      render: (row) => (
        <>
          <strong>{row.actor.name}</strong>
          <div>{row.actor.role ? label(row.actor.role) : 'Public / system'}</div>
        </>
      ),
    },
    { key: 'action', label: 'Activity', render: (row) => label(row.action) },
    { key: 'entityType', label: 'Record type' },
    {
      key: 'entityLabel',
      label: 'Record',
      render: (row) => <span title={row.entityId}>{row.entityLabel || '?'}</span>,
    },
    {
      key: 'changedFields',
      label: 'Updated fields',
      render: (row) => row.changedFields.map(label).join(', ') || '?',
    },
  ];
  return (
    <>
      <PageHeader
        title={
          user.role === 'ADMIN'
            ? 'Team activity'
            : user.role === 'MANAGER'
              ? 'Branch activity'
              : 'My activity'
        }
        description="See who created, updated or processed a record and when."
      >
        <button
          className="btn secondary"
          onClick={() => query.refetch()}
          disabled={query.isFetching}
        >
          {query.isFetching ? 'Refreshing?' : 'Refresh'}
        </button>
      </PageHeader>
      <section className="panel">
        <div className="filter-bar">
          <SearchInput value={filters.search || ''} onChange={(value) => update('search', value)} />
          <select
            aria-label="Record type"
            value={filters.entityType || ''}
            onChange={(event) => update('entityType', event.target.value)}
          >
            <option value="">All record types</option>
            {['User', 'Branch', 'Customer', 'Shipment', 'ShipmentDocument', 'UploadSession'].map(
              (type) => (
                <option key={type}>{type}</option>
              ),
            )}
          </select>
          <label>
            From{' '}
            <input
              type="date"
              value={filters.dateFrom || ''}
              onChange={(event) => update('dateFrom', event.target.value)}
            />
          </label>
          <label>
            To{' '}
            <input
              type="date"
              value={filters.dateTo || ''}
              onChange={(event) => update('dateTo', event.target.value)}
            />
          </label>
          <button className="text-btn" onClick={() => setParams({})}>
            Clear filters
          </button>
        </div>
        {query.isPending ? (
          <Loadingcrleleton />
        ) : query.isError ? (
          <ErrorState error={errorMessage(query.error)} retry={query.refetch} />
        ) : (
          <DataTable
            rows={query.data.data}
            columns={columns}
            pagination={query.data.pagination}
            onPage={(page) => update('page', page)}
          />
        )}
      </section>
    </>
  );
}
