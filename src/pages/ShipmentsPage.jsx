import { Link } from 'react-router-dom';
import { Plus, SlidersHorizontal } from 'lucide-react';
import { useAuth } from '../features/auth/AuthContext';
import { useList } from '../hooks/useList';
import { shipmentsApi } from '../api/services';
import { errorMessage } from '../api/client';
import { PageHeader, Loadingcrleleton, ErrorState } from '../components/common/UI';
import SearchInput from '../components/forms/SearchInput';
import Lookup from '../components/forms/Lookup';
import ShipmentTable from '../components/shipment/ShipmentTable';
import { statuses, label } from '../lib/workflow';
export default function ShipmentsPage() {
  const { user } = useAuth();
  const base = `/${user.role.toLowerCase()}`;
  const { query, filters, update, clear, sort } = useList('shipments', shipmentsApi);
  return (
    <>
      <PageHeader title="Shipments" description="Every LR, from booking to the final mile.">
        <Link className="btn" to={`${base}/shipments/create`}>
          <Plus size={17} /> Create LR
        </Link>
      </PageHeader>
      <section className="panel">
        <div className="filter-bar">
          <SearchInput
            value={filters.search}
            onChange={(v) => update('search', v)}
            placeholder="Search LR number or sender…"
          />
          <select
            aria-label="Shipment status"
            value={filters.status || ''}
            onChange={(e) => update('status', e.target.value)}
          >
            <option value="">All statuses</option>
            {statuses.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <details className="advanced-filters">
            <summary>
              <SlidersHorizontal size={16} /> More filters
            </summary>
            <div className="filter-popover">
              <Lookup
                resource="customers"
                label="Customer"
                value={filters.customerId}
                onChange={(v) => update('customerId', v)}
              />
              <Lookup
                resource="branches"
                label="Origin branch"
                value={filters.originBranchId}
                onChange={(v) => update('originBranchId', v)}
              />
              <Lookup
                resource="branches"
                label="Destination branch"
                value={filters.destinationBranchId}
                onChange={(v) => update('destinationBranchId', v)}
              />
              {['dateFrom', 'dateTo'].map((k) => (
                <label key={k}>
                  {label(k === 'dateFrom' ? 'FROM' : 'TO')}
                  <input
                    type="date"
                    value={filters[k] || ''}
                    onChange={(e) => update(k, e.target.value)}
                  />
                </label>
              ))}
            </div>
          </details>
          <button className="text-btn" onClick={clear}>
            Clear filters
          </button>
        </div>
        {query.isPending ? (
          <Loadingcrleleton />
        ) : query.isError ? (
          <ErrorState error={errorMessage(query.error)} retry={query.refetch} />
        ) : (
          <ShipmentTable
            base={base}
            rows={query.data.data}
            pagination={query.data.pagination}
            onPage={(p) => update('page', p)}
            onSort={sort}
          />
        )}
      </section>
    </>
  );
}
