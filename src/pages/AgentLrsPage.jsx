import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Eye, PackageCheck, RefreshCw, Truck, UserRoundCheck } from 'lucide-react';
import { agentLrsApi } from '../api/services';
import { errorMessage } from '../api/client';
import { useAuth } from '../features/auth/AuthContext';
import { useDebounce } from '../hooks/useList';
import { idOf, label } from '../lib/workflow';
import { DataTable, ErrorState, Loadingcrleleton, PageHeader, StatCard, StatusBadge } from '../components/common/UI';

const paymentFor = (row) => row.pickupRunSheetId?.purEntries?.find(
  (entry) => idOf(entry.pickupRequestId) === idOf(row),
);

export default function AgentLrsPage() {
  const { user } = useAuth();
  const base = `/${user.role.toLowerCase()}`;
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [sourceType, setSourceType] = useState('');
  const term = useDebounce(search.trim());
  const query = useQuery({
    queryKey: ['agent-lrs', term, status, sourceType],
    queryFn: () => agentLrsApi.list({ limit: 100, ...(term && { search: term }), ...(status && { status }), ...(sourceType && { sourceType }) }),
    refetchInterval: 30000,
  });
  if (query.isPending) return <Loadingcrleleton />;
  if (query.isError) return <ErrorState error={errorMessage(query.error)} retry={query.refetch} />;
  const rows = query.data?.data || [];
  const counts = {
    total: query.data?.pagination?.total ?? rows.length,
    aligned: rows.filter((row) => row.agentAssignment).length,
    onPrs: rows.filter((row) => row.pickupRunSheetId).length,
    dispatched: rows.filter((row) => row.pickupRunSheetId?.status === 'DISPATCHED').length,
  };
  return (
    <>
      <PageHeader title="Agent LR · Auto Reflecting" description="LRs automatically appear here from Agent Alignment and PRS—no duplicate entry required.">
        <button className="btn secondary" disabled={query.isFetching} onClick={() => query.refetch()}><RefreshCw size={16} /> {query.isFetching ? 'Refreshing…' : 'Refresh now'}</button>
      </PageHeader>
      <div className="stats-grid agent-summary">
        <StatCard label="Total agent LRs" value={counts.total} icon={PackageCheck} />
        <StatCard label="Agent aligned" value={counts.aligned} icon={UserRoundCheck} />
        <StatCard label="Added to PRS" value={counts.onPrs} />
        <StatCard label="First Mile complete" value={counts.dispatched} icon={Truck} />
      </div>
      <section className="panel">
        <div className="panel-heading agent-lr-heading">
          <div><h2>Auto-reflected LR register</h2><p>Automatically refreshes every 30 seconds. Last sync: {new Date(query.dataUpdatedAt).toLocaleTimeString('en-IN')}</p></div>
          <div className="actions">
            <input aria-label="Search agent LRs" placeholder="Search LR, PUR, agent or vehicle" value={search} onChange={(event) => setSearch(event.target.value)} />
            <select aria-label="Filter by pickup status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option><option value="PENDING">Pending</option><option value="DISPATCHED">Dispatched</option><option value="CANCELLED">Cancelled</option></select>
            <select aria-label="Filter by vehicle source" value={sourceType} onChange={(event) => setSourceType(event.target.value)}><option value="">All sources</option><option value="VENDOR">Vendor</option><option value="MARKET">Market</option></select>
          </div>
        </div>
        <DataTable rows={rows} empty="No agent-aligned LRs found" columns={[
          { key: 'lr', label: 'LR / PUR', render: (row) => <span className="agent-lr-primary"><b>{row.shipmentId?.lrNumber}</b><small>{row.pickupRequestNumber}</small></span> },
          { key: 'party', label: 'Pickup client', render: (row) => <span className="agent-lr-primary"><b>{row.shipper?.companyName}</b><small>{row.shipper?.city} → {row.recipient?.city}</small></span> },
          { key: 'agent', label: 'Agent / FE', render: (row) => <span className="agent-lr-primary"><b>{row.pickupRunSheetId?.fieldExecutiveName || row.agentAssignment?.agentName}</b><small>{row.pickupRunSheetId?.fieldExecutiveMobile || row.agentAssignment?.driverMobile}</small></span> },
          { key: 'vendor', label: 'Vendor source', render: (row) => row.pickupRunSheetId ? `${row.pickupRunSheetId.vendorCode} · ${row.pickupRunSheetId.vendorName}` : row.agentAssignment?.sourceType === 'MARKET' ? `Market · ${row.agentAssignment.agentName}` : row.agentAssignment?.vendorId?.name || 'Vendor' },
          { key: 'vehicle', label: 'Vehicle', render: (row) => `${row.pickupRunSheetId?.vehicleNumber || row.agentAssignment?.vehicleNumber} · ${row.pickupRunSheetId?.vehicleType || row.agentAssignment?.vehicleType || '—'}` },
          { key: 'load', label: 'Load', render: (row) => `${row.totalBoxes} boxes · ${row.totalWeightKg} kg` },
          { key: 'payment', label: 'Payment', render: (row) => { const payment = paymentFor(row); return payment ? `${label(payment.paymentTerm)} · ₹ ${Number(payment.amount || 0).toLocaleString('en-IN')}` : 'Not added to PRS'; } },
          { key: 'dispatch', label: 'PRS / Dispatch', render: (row) => row.pickupRunSheetId ? <span className="agent-lr-primary"><b>{row.pickupRunSheetId.prsNumber}</b><small>{row.pickupRunSheetId.dispatchId || 'Not dispatched'}</small></span> : 'Awaiting PRS' },
          { key: 'status', label: 'First Mile', render: (row) => <StatusBadge status={row.pickupRunSheetId?.status === 'DISPATCHED' ? 'FIRST_MILE_COMPLETE' : row.pickupRunSheetId ? row.pickupRunSheetId.status : 'LR_CREATED'} /> },
          { key: 'action', label: 'Action', render: (row) => <div className="actions"><Link className="text-btn" to={`${base}/shipments/${idOf(row.shipmentId)}`}><Eye size={14} /> LR</Link>{row.pickupRunSheetId && <Link className="text-btn" to={`${base}/pickup-run-sheets/${idOf(row.pickupRunSheetId)}`}>PRS</Link>}</div> },
        ]} />
      </section>
    </>
  );
}
