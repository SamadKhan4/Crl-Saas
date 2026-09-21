import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { profitabilityApi } from '../api/services';
import { errorMessage } from '../api/client';
import { DataTable, ErrorState, Loadingcrleleton, PageHeader, StatCard } from '../components/common/UI';

const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
export default function ProfitabilityPage() {
  const [filters, setFilters] = useState({});
  const query = useQuery({ queryKey: ['profitability', filters], queryFn: () => profitabilityApi.summary(filters) });
  const update = (key, value) => setFilters((current) => ({ ...current, [key]: value || undefined }));
  return <><PageHeader title="Profitability" description="LR-wise revenue, operational cost, gross profit and margin." />
    <section className="panel form-section"><div className="form-grid"><label>From<input type="date" onChange={(e) => update('dateFrom', e.target.value)} /></label><label>To<input type="date" onChange={(e) => update('dateTo', e.target.value)} /></label></div></section>
    {query.isPending ? <Loadingcrleleton /> : query.isError ? <ErrorState error={errorMessage(query.error)} retry={query.refetch} /> : <><div className="stats-grid"><StatCard label="Client revenue" value={money(query.data.data.totals.revenue)} /><StatCard label="Total cost" value={money(query.data.data.totals.cost)} /><StatCard label="Gross profit" value={money(query.data.data.totals.profit)} /></div><section className="panel"><DataTable rows={query.data.data.rows} columns={[{ key: 'lrNumber', label: 'LR' }, { key: 'customer', label: 'Customer' }, { key: 'revenue', label: 'Revenue', render: (r) => money(r.revenue) }, { key: 'cost', label: 'Cost', render: (r) => money(r.cost) }, { key: 'profit', label: 'Profit', render: (r) => money(r.profit) }, { key: 'marginPercent', label: 'Margin', render: (r) => `${r.marginPercent}%` }]} /></section></>}
  </>;
}
