import { useQuery } from '@tanstack/react-query';
import { get, errorMessage } from '../../api/client';
import { date } from '../../lib/workflow';

const money = (value) => Number(value || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR' });

export function VendorWork({ vendorId, values }) {
  const query = useQuery({ queryKey: ['vendor-settlements', 'work', vendorId], queryFn: () => get(`/vendors/${vendorId}/settlement-work`), enabled: Boolean(vendorId) });
  if (!vendorId) return <p>Select a vendor code to fetch linked LRs and operations.</p>;
  if (query.isPending) return <p>Loading vendor work...</p>;
  if (query.isError) return <p role="alert">{errorMessage(query.error)}</p>;
  const work = query.data.data;
  const meta = values.metadata || {};
  const gross = work.calculation.commission + Number(meta.detention || 0) + Number(meta.loading || 0) + Number(meta.otherCharge || 0);
  const advance = meta.advance === undefined || meta.advance === '' ? work.advance : Number(meta.advance);
  return <section className="tms-span-2" style={{ overflowX: 'auto' }}>
    <h3>{work.vendor.vendorCode} - {work.vendor.name}</h3>
    <p>{work.shipments.length} unsettled LRs | {work.operations.length} operations | {work.settledLrCount} previously billed LRs excluded</p>
    <p><b>Commission:</b> {work.calculation.rateBasis} - {work.calculation.units} units x {money(work.calculation.agreedRate)} = {money(work.calculation.commission)}</p>
    <p>Per trip counts each vendor trip and pickup run once. Manifests and DRS are reference records; they do not add trip units.</p>
    <h4>LR breakdown</h4><LrTable rows={work.shipments} />
    <h4>Trips, pickup runs, manifests and delivery runs</h4><OperationTable rows={work.operations} />
    <p>Recorded operation costs are reference amounts. The agreed-rate commission is charged once.</p>
    <p>Recorded trip advance: {money(work.advance)}. Leave advance blank to use this amount.</p>
    <p><b>Gross:</b> {money(gross)} | <b>Deductions:</b> {money(Number(meta.tds || 0) + advance)} | <b>Net payable:</b> {money(gross - Number(meta.tds || 0) - advance)}</p>
    {!work.shipments.length && !work.operations.length && <p>No unsettled work found for this vendor.</p>}
    {work.operations.some((row) => !row.eligible) && <p role="alert">Pending/rejected market rate approvals must be resolved before settlement.</p>}
  </section>;
}

function LrTable({ rows = [] }) {
  return <table className="invoice-table"><thead><tr>{['LR', 'Date', 'Customer / recipient', 'Route', 'Packages', 'Weight (kg)', 'LR freight', 'Status'].map((caption) => <th key={caption}>{caption}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{row.lrNumber}</td><td>{date(row.bookingDate)}</td><td>{row.senderName} / {row.receiverName}</td><td>{row.origin} - {row.destination}</td><td>{row.packageCount}</td><td>{row.weightKg}</td><td>{money(row.freight)}</td><td>{row.status}</td></tr>)}</tbody></table>;
}
function OperationTable({ rows = [] }) {
  return <table className="invoice-table"><thead><tr>{['Type', 'Reference', 'Date', 'Vehicle', 'Route', 'LRs', 'Recorded cost', 'Advance', 'Status'].map((caption) => <th key={caption}>{caption}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.key}><td>{row.type}</td><td>{row.number}</td><td>{date(row.date)}</td><td>{row.vehicleNumber}</td><td>{row.route}</td><td>{row.shipmentIds?.length || 0}</td><td>{money(row.recordedCost)}</td><td>{money(row.advance)}</td><td>{row.status}</td></tr>)}</tbody></table>;
}
export function VendorSettlementSheet({ record }) {
  const meta = record.metadata || {};
  const vendor = meta.vendor || record.vendorId || {};
  return <article className="transport-print-document invoice-document"><section className="invoice-page">
    <header className="invoice-brand"><img src="/crl-logo.png" alt="CRL" /><div><h2>CHAPLE ROADLINES PVT. LTD.</h2><p>Goods Transport & Logistics Services</p></div><strong>VENDOR COMMISSION INVOICE</strong></header>
    <h3>{record.recordNumber}</h3><p>Bill date: {date(record.operationDate)} | Due date: {date(record.dueDate)} | Status: {record.status}</p>
    <h3>{vendor.vendorCode} - {vendor.name}</h3><p>{vendor.address} | GSTIN: {vendor.gstNumber || 'Unregistered'}</p>
    <p>{record.title} | Reference: {record.reference || '-'} | Vendor invoice: {record.documentNumber || '-'}</p>
    <h3>Agreed-rate commission</h3><p>{meta.rateBasis} | {meta.units} units x {money(meta.agreedRate)} = {money(meta.commission)}</p>
    <h3>LR details</h3><LrTable rows={meta.lrDetails} />
    <h3>Operation details</h3><OperationTable rows={meta.operations} />
    <h3>Settlement breakdown</h3><table className="invoice-table"><tbody>{[['Commission', meta.commission ?? meta.baseAmount], ['Detention', meta.detention], ['Loading / unloading', meta.loading], ['Other charges', meta.otherCharge], ['Gross', meta.gross], ['TDS deduction', meta.tds], ['Advance', meta.advance], ['Total deductions', meta.deductions], ['Net payable', record.amount]].map(([caption, value]) => <tr key={caption}><th>{caption}</th><td>{money(value || 0)}</td></tr>)}</tbody></table>
    <p>{record.description}</p><p>{record.remarks}</p><p>Prepared by: ____________________ | Vendor acknowledgement: ____________________</p>
  </section></article>;
}
