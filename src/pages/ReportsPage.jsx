import { useAuth } from '../features/auth/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { reportsApi } from '../api/services';
import { download, errorMessage } from '../api/client';
import { PageHeader, StatCard, Loadingcrleleton, ErrorState } from '../components/common/UI';
import Lookup from '../components/forms/Lookup';
import ShipmentTable from '../components/shipment/ShipmentTable';
import { statuses, label } from '../lib/workflow';
import { dateRangeParams } from '../lib/filters';
export default function ReportsPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams(),
    [busy, setBusy] = useState(false),
    [page, setPage] = useState(1);
  const filters = Object.fromEntries(
    [...params].filter(([key]) =>
      ['dateFrom', 'dateTo', 'status', 'branch', 'customer'].includes(key),
    ),
  );
  const query = useQuery({
    queryKey: ['reports', filters, page],
    queryFn: () => reportsApi.list({ ...filters, page, limit: 20 }),
  });
  function update(key, value) {
    setPage(1);
    setParams((p) => {
      value ? p.set(key, value) : p.delete(key);
      return p;
    });
  }
  async function exportCsv() {
    setBusy(true);
    try {
      await download('/reports/shipments/export', 'sk-logistic-shipments.csv', dateRangeParams(filters));
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  const rows = query.data?.data || [];
  return (
    <>
      <PageHeader
        title="Shipment reports"
        description="Filter your shipment records and export the results."
      >
        <button className="btn" disabled={busy} onClick={exportCsv}>
          <Download size={17} />
          {busy ? 'Exporting…' : 'Export CSV'}
        </button>
      </PageHeader>
      <section className="panel form-section">
        <div className="form-grid">
          {['dateFrom', 'dateTo'].map((k) => (
            <label key={k}>
              {k === 'dateFrom' ? 'From date' : 'To date'}
              <input
                type="date"
                value={filters[k] || ''}
                onChange={(e) => update(k, e.target.value)}
              />
            </label>
          ))}
          <label>
            Status
            <select value={filters.status || ''} onChange={(e) => update('status', e.target.value)}>
              <option value="">All statuses</option>
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {label(s)}
                </option>
              ))}
            </select>
          </label>
          <Lookup
            resource="customers"
            label="Customer"
            value={filters.customer}
            onChange={(v) => update('customer', v)}
          />
          <Lookup
            resource="branches"
            label="Branch (origin or destination)"
            value={filters.branch}
            onChange={(v) => update('branch', v)}
          />
          <button
            className="text-btn"
            onClick={() => {
              setParams({});
              setPage(1);
            }}
          >
            Clear filters
          </button>
        </div>
      </section>
      {query.isPending ? (
        <Loadingcrleleton />
      ) : query.isError ? (
        <ErrorState error={errorMessage(query.error)} retry={query.refetch} />
      ) : (
        <>
          <div className="stats-grid report-stats">
            {[
              ['Total shipments', null],
              ['Completed', 'COMPLETED'],
              ['Closed', 'CLOSED'],
              ['In transit', 'IN_TRANSIT'],
              ['Cancelled', 'CANCELLED'],
            ].map(([caption, status]) => (
              <StatCard
                key={caption}
                label={caption}
                value={
                  status
                    ? query.data.summary?.statuses?.[status] || 0
                    : query.data.summary?.total || 0
                }
              />
            ))}
          </div>
          <section className="panel">
            <ShipmentTable
              compact
              base={`/${user.role.toLowerCase()}`}
              rows={rows}
              pagination={query.data.pagination}
              onPage={setPage}
            />
          </section>
        </>
      )}
    </>
  );
}
