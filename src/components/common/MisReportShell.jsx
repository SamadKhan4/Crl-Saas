import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Download, Printer, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { get, api, errorMessage, download } from '../../api/client';
import { useAuth } from '../../features/auth/AuthContext';
import { PageHeader, StatCard, DataTable, Loadingcrleleton, ErrorState, Modal } from './UI';
import Lookup from '../forms/Lookup';
import SearchInput from '../forms/SearchInput';
import { misReportConfig } from '../../lib/misReportConfig';
import { date, idOf } from '../../lib/workflow';
const monetary = new Set(['freight', 'additional', 'taxable', 'gst', 'total', 'paid', 'balance', 'overdue', 'notDue', 'age30', 'age60', 'age90', 'ageMore', 'noDue', 'estimated', 'previousFreight', 'freightChange']);
const money = (value) => Number(value).toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
function format(value, column) {
  if (value === null || value === undefined) return '--';
  if (column.type === 'date') return date(value);
  if (Array.isArray(value)) return value.join(', ') || '--';
  if (column.type === 'number') return monetary.has(column.key) ? money(value) : Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  return String(value);
}
export default function MisReportShell({ title, report }) {
  const config = misReportConfig[report];
  const { user } = useAuth();
  const base = `/${user.role.toLowerCase()}`;
  const [params, setParams] = useSearchParams();
  const [exporting, setExporting] = useState(false);
  const [selected, setSelected] = useState(null);
  const filters = Object.fromEntries(params);
  const query = useQuery({ queryKey: ['mis-report', report, filters], queryFn: () => get(`/reports/mis/${report}`, filters) });
  function update(key, value) {
    setParams((current) => { const next = new URLSearchParams(current); value === '' || value == null ? next.delete(key) : next.set(key, String(value)); if (key !== 'page') next.delete('page'); return next; });
  }
  async function exportCsv() {
    setExporting(true);
    try { const search = new URLSearchParams(filters); search.delete('page'); search.delete('limit'); await download(`/reports/mis/${report}/export?${search}`, `crl-${report}.csv`); }
    catch (error) { toast.error(errorMessage(error)); } finally { setExporting(false); }
  }
  const data = query.data;
  const columns = (data?.columns || []).map((column) => ({ ...column, sort: column.key, render: (row) => format(row[column.key], column) }));
  columns.unshift({ key: 'serial', label: 'Sr. No.', render: (row) => (Number(data?.pagination.page || 1) - 1) * Number(data?.pagination.limit || 20) + (data?.data || []).indexOf(row) + 1 });
  columns.push({ key: 'actions', label: 'Actions', render: (row) => <div className="mis-report-actions">
    {row.shipmentId && <Link className="text-btn" title="View LR and movement history" to={`${base}/shipments/${row.shipmentId}`}><Eye size={14} aria-hidden="true" />View LR</Link>}
    {row.tripId && <button className="text-btn" onClick={() => setSelected({ ...row, number: row.tripNumber })}>View Trip / Manifests</button>}
    {report === 'drs-details' && <><button className="text-btn" onClick={() => setSelected(row)}>View Deliveries / POD</button><Link className="text-btn" to={`${base}/drs/${row.id}`}>Open / Print DRS</Link></>}
    {report === 'invoice-details' && <><Link className="text-btn" to={`${base}/invoices/${row.id}`}>View / Print Invoice</Link><button className="text-btn" onClick={() => setSelected(row)}>Payments / LRs</button></>}
    {report === 'branch-outstanding' && <Link className="text-btn" to={`${base}/reports/invoice-details?${new URLSearchParams({ ...filters, page: '1', branch: row.id })}`}>Contributing Invoices</Link>}
    {report === 'customer-business' && <><Link className="text-btn" to={`${base}/customers/${row.customerId}`}>Customer / LRs</Link><Link className="text-btn" to={`${base}/reports/invoice-details?customer=${row.customerId}`}>Invoices</Link></>}
    {report === 'unbilled-details' && (row.eligible ? <Link className="text-btn" to={`${base}/invoices`} state={{ billingDraft: { customerId: row.customerId, shipmentIds: [row.shipmentId] } }}>Generate Invoice</Link> : <span>{row.reason}</span>)}
    {report === 'branch-loa' && <><button className="text-btn" onClick={() => setSelected(row)}>View Authorization</button>{row.hasDocument && <button className="text-btn" onClick={() => download(`/reports/authorizations/${row.id}/document`, `${row.number}.pdf`).catch((error) => toast.error(errorMessage(error)))}>Download PDF</button>}</>}
  </div> });
  const dates = (from, to, caption) => <><label>{caption} from<input type="date" value={filters[from] || ''} onChange={(event) => update(from, event.target.value)} /></label><label>{caption} to<input type="date" value={filters[to] || ''} onChange={(event) => update(to, event.target.value)} /></label></>;
  return <>
    <PageHeader title={title} description={config.description}><button className="btn secondary" disabled={exporting || query.isPending || query.isError} onClick={exportCsv}><Download size={16} />{exporting ? 'Exporting...' : 'Export CSV'}</button><button className="btn secondary" onClick={() => window.print()}><Printer size={16} />Print</button></PageHeader>
    <section className="panel form-section mis-report-filters">
      <SearchInput value={filters.search || ''} onChange={(value) => update('search', value)} placeholder="Search report records" />
      <div className="form-grid">
        {dates('dateFrom', 'dateTo', config.dateLabel)}
        {config.filters.includes('branch') && <Lookup resource="branches" activeOnly={false} label={report === 'hub-in-transits' ? 'Origin Hub' : 'Branch / Godown'} value={filters.branch} onChange={(value) => update('branch', value)} />}
        {config.filters.includes('destination') && <Lookup resource="branches" activeOnly={false} label="Destination Branch" value={filters.destination} onChange={(value) => update('destination', value)} />}
        {config.filters.includes('customer') && <Lookup resource="customers" activeOnly={false} label="Customer" value={filters.customer} onChange={(value) => update('customer', value)} />}
        {config.filters.includes('employee') && <Lookup resource="users" activeOnly={false} label="Delivery Employee" value={filters.employee} onChange={(value) => update('employee', value)} />}
        {config.statuses && <label>Status<select value={filters.status || ''} onChange={(event) => update('status', event.target.value)}><option value="">All statuses</option>{config.statuses.map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select></label>}
        {config.buckets && <label>Ageing category<select value={filters.bucket || ''} onChange={(event) => update('bucket', event.target.value)}><option value="">All categories</option>{config.buckets.map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select></label>}
        {config.filters.includes('vehicle') && <label>Vehicle number<input value={filters.vehicle || ''} maxLength={30} onChange={(event) => update('vehicle', event.target.value)} /></label>}
        {config.filters.includes('minDays') && <label>Minimum pending days<input type="number" min="0" value={filters.minDays || ''} onChange={(event) => update('minDays', event.target.value)} /></label>}
        {config.filters.includes('threshold') && <label>Ageing threshold (days)<input type="number" min="0" value={filters.threshold ?? 7} onChange={(event) => update('threshold', event.target.value)} /></label>}
        {config.filters.includes('due') && dates('dueFrom', 'dueTo', report === 'branch-loa' ? 'Expiry' : 'Due date')}
        {config.filters.includes('billing') && dates('billingFrom', 'billingTo', 'Billing date')}
        <label>Rows per page<select value={filters.limit || '20'} onChange={(event) => update('limit', event.target.value)}>{[20, 50, 100].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <button className="text-btn" onClick={() => setParams({})}>Clear filters</button>
      </div>
      {config.note && <p className="notice">{config.note}</p>}
    </section>
    {query.isPending ? <Loadingcrleleton /> : query.isError ? <ErrorState error={errorMessage(query.error)} retry={query.refetch} /> : <>
      <div className="stats-grid report-stats">{Object.entries(data.metrics || {}).map(([key, caption]) => <StatCard key={key} label={caption} value={monetary.has(key) ? money(data.summary?.[key] || 0) : Number(data.summary?.[key] || 0).toLocaleString('en-IN')} />)}</div>
      <section className="panel mis-report-table"><DataTable rows={data.data} columns={columns} pagination={data.pagination} onPage={(page) => update('page', page)} onSort={(key) => { setParams((current) => { const next = new URLSearchParams(current); next.set('sortBy', key); next.set('sortOrder', filters.sortBy === key && filters.sortOrder === 'asc' ? 'desc' : 'asc'); next.delete('page'); return next; }); }} empty="No matching report records" /></section>
    </>}
    {selected && <ReportDetail report={report} row={selected} onClose={() => setSelected(null)} base={base} />}
  </>;
}
function ReportDetail({ report, row, onClose, base }) {
  const path = report === 'hub-in-transits' ? `/trips/${row.tripId}` : report === 'branch-loa' ? `/reports/authorizations/${row.id}` : report === 'drs-details' ? `/last-mile/drs/${row.id}` : `/invoices/${row.id}`;
  const query = useQuery({ queryKey: ['mis-detail', report, row.id], queryFn: () => get(path) });
  const payments = useQuery({ queryKey: ['mis-payments', row.id], enabled: report === 'invoice-details', queryFn: () => get(`/reports/invoice-payments/${row.id}`) });
  const [preview, setPreview] = useState('');
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  async function previewDocument() {
    try { const response = await api.get(`/reports/authorizations/${row.id}/document`, { responseType: 'blob' }); setPreview(URL.createObjectURL(response.data)); }
    catch (error) { toast.error(errorMessage(error)); }
  }
  const record = query.data?.data;
  return <Modal title={row.number} onClose={onClose}>
    {query.isPending ? <Loadingcrleleton /> : query.isError ? <ErrorState error={errorMessage(query.error)} retry={query.refetch} /> : report === 'drs-details' ? <DataTable rows={record.shipmentIds || []} columns={[
      { key: 'lrNumber', label: 'LR', render: (shipment) => <Link to={`${base}/shipments/${idOf(shipment)}`}>{shipment.lrNumber}</Link> },
      { key: 'outcome', label: 'Outcome', render: (shipment) => record.items?.find((item) => idOf(item.shipmentId) === idOf(shipment))?.attemptStatus || 'PENDING' },
      { key: 'receiver', label: 'Actual Receiver', render: (shipment) => record.deliveryProofs?.find((proof) => idOf(proof.shipmentId) === idOf(shipment))?.receiverName || '--' },
      { key: 'deliveredAt', label: 'Delivery Time', render: (shipment) => { const value = record.deliveryProofs?.find((proof) => idOf(proof.shipmentId) === idOf(shipment))?.deliveredAt; return value ? new Date(value).toLocaleString('en-IN') : '--'; } },
      { key: 'remarks', label: 'Delivery / Failure Remarks', render: (shipment) => { const item = record.items?.find((item) => idOf(item.shipmentId) === idOf(shipment)); const proof = record.deliveryProofs?.find((proof) => idOf(proof.shipmentId) === idOf(shipment)); return proof?.remarks || item?.failureReason || item?.remarks || '--'; } },
      { key: 'pod', label: 'POD', render: (shipment) => { const proof = record.deliveryProofs?.find((proof) => idOf(proof.shipmentId) === idOf(shipment)); return proof?.documentId ? <button className="text-btn" onClick={() => download(`/shipments/${idOf(shipment)}/documents/${idOf(proof.documentId)}/download`, `${shipment.lrNumber}-POD`).catch((error) => toast.error(errorMessage(error)))}>Download POD</button> : 'Pending'; } },
    ]} /> : report === 'hub-in-transits' ? <><dl className="detail-grid">{['tripNumber', 'origin', 'destination', 'vehicleNumber', 'driverName', 'departureDate', 'expectedArrival', 'arrivedAt', 'status'].map((key) => <div key={key}><dt>{key}</dt><dd>{String(record[key] || '--')}</dd></div>)}</dl><h3>Manifests</h3>{(record.manifestIds || []).map((manifest) => <p key={idOf(manifest)}><Link to={`${base}/manifests/${idOf(manifest)}`}>{manifest.manifestNumber || idOf(manifest)}</Link></p>)}</> : report === 'branch-loa' ? <><dl className="detail-grid">{['loaNumber', 'authorizedTo', 'purpose', 'documentReference', 'issueDate', 'effectiveFrom', 'validUntil', 'revokedAt'].map((key) => <div key={key}><dt>{key}</dt><dd>{String(record[key] || '--')}</dd></div>)}</dl>{row.hasDocument && <button className="btn secondary" onClick={previewDocument}>Preview PDF</button>}{preview && <iframe title="Authorization PDF" src={preview} style={{ width: '100%', height: 500 }} />}</> : <>
      <h3>Invoice consignments</h3><DataTable rows={record.lineItems || []} columns={[{ key: 'lrNumber', label: 'LR' }, { key: 'taxableAmount', label: 'Saved Taxable Amount', render: (line) => money(line.taxableAmount) }]} />
      <h3>Posted payment allocations</h3>{payments.isPending ? <Loadingcrleleton /> : payments.isError ? <ErrorState error={errorMessage(payments.error)} retry={payments.refetch} /> : <DataTable rows={payments.data.data} columns={[{ key: 'receiptNumber', label: 'Receipt' }, { key: 'receiptDate', label: 'Date', render: (receipt) => date(receipt.receiptDate) }, { key: 'paymentMode', label: 'Payment Mode' }, { key: 'allocatedAmount', label: 'Allocated Amount', render: (receipt) => money(receipt.allocatedAmount) }]} />}
    </>}
  </Modal>;
}
