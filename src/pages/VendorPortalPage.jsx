import { useQuery } from '@tanstack/react-query';
import { get } from '../api/client';
import { errorMessage } from '../api/client';
import { DataTable, ErrorState, Loadingcrleleton, PageHeader, StatCard, StatusBadge } from '../components/common/UI';
import { date } from '../lib/workflow';
const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
export default function VendorPortalPage() {
  const query = useQuery({ queryKey: ['vendor-portal'], queryFn: () => get('/vendor-portal/summary') });
  if (query.isPending) return <Loadingcrleleton />;
  if (query.isError) return <ErrorState error={errorMessage(query.error)} retry={query.refetch} />;
  const data = query.data.data;
  return <><PageHeader title={data.vendor?.name || 'Vendor Portal'} description="Assigned trips, manifests, deliveries, bills and payment status." />
    <div className="stats-grid"><StatCard label="Trips" value={data.trips.length} /><StatCard label="Manifests" value={data.manifests.length} /><StatCard label="Delivery runs" value={data.deliveries.length} /><StatCard label="Outstanding" value={money(data.outstanding)} /></div>
    <section className="panel"><div className="panel-heading"><h2>Assigned trips</h2></div><DataTable rows={data.trips} columns={[{ key: 'tripNumber', label: 'Trip' }, { key: 'lane', label: 'Lane', render: (r) => `${r.origin} → ${r.destination}` }, { key: 'vehicleNumber', label: 'Vehicle' }, { key: 'departureDate', label: 'Departure', render: (r) => date(r.departureDate) }, { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> }]} /></section>
    <section className="panel"><div className="panel-heading"><h2>Vendor bills & settlements</h2></div><DataTable rows={data.settlements} columns={[{ key: 'recordNumber', label: 'Settlement' }, { key: 'reference', label: 'Reference' }, { key: 'operationDate', label: 'Bill date', render: (r) => date(r.operationDate) }, { key: 'amount', label: 'Payable', render: (r) => money(r.amount) }, { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> }]} /></section>
  </>;
}
