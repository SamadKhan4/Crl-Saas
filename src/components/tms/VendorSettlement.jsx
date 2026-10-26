import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { get, errorMessage } from '../../api/client';
import { date } from '../../lib/workflow';

const money = (value) => Number(value || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR' });

export function VendorWork({ vendorId, values, setValues }) {
  const query = useQuery({ queryKey: ['vendor-settlements', 'work', vendorId], queryFn: () => get(`/vendors/${vendorId}/settlement-work`), enabled: Boolean(vendorId) });
  const filledVendor = useRef(null);
  useEffect(() => {
    if (!vendorId) { filledVendor.current = null; return; }
    const defaults = query.data?.data?.defaults;
    if (!defaults || filledVendor.current === vendorId) return;
    filledVendor.current = vendorId;
    setValues((current) => current.vendorId !== vendorId ? current : {
      ...current,
      ...defaults,
      vendorId,
      metadata: { ...defaults.metadata },
    });
  }, [vendorId, query.data, setValues]);
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
  return <table className="vendor-work-table vendor-lr-table"><thead><tr>{['LR', 'Date', 'Customer / recipient', 'Route', 'Packages', 'Weight (kg)', 'LR freight', 'Status'].map((caption) => <th key={caption}>{caption}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{row.lrNumber}</td><td>{date(row.bookingDate)}</td><td>{row.senderName} / {row.receiverName}</td><td>{row.origin} - {row.destination}</td><td>{row.packageCount}</td><td>{row.weightKg}</td><td>{money(row.freight)}</td><td>{row.status}</td></tr>)}</tbody></table>;
}
function OperationTable({ rows = [] }) {
  return <table className="vendor-work-table vendor-operation-table"><thead><tr>{['Type', 'Reference', 'Date', 'Vehicle', 'Route', 'LRs', 'Recorded cost', 'Advance', 'Status'].map((caption) => <th key={caption}>{caption}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.key}><td>{row.type}</td><td>{row.number}</td><td>{date(row.date)}</td><td>{row.vehicleNumber}</td><td>{row.route}</td><td>{row.shipmentIds?.length || 0}</td><td>{money(row.recordedCost)}</td><td>{money(row.advance)}</td><td>{row.status}</td></tr>)}</tbody></table>;
}
export function VendorSettlementSheet({ record }) {
  const meta = record.metadata || {};
  const vendor = meta.vendor || record.vendorId || {};
  const chunk = (rows, size) => Array.from({ length: Math.ceil(rows.length / size) }, (_, index) => rows.slice(index * size, index * size + size));
  const pages = [
    ...chunk(meta.lrDetails || [], 10).map((rows) => ({ type: 'lr', rows })),
    ...chunk(meta.operations || [], 8).map((rows) => ({ type: 'operations', rows })),
    { type: 'totals' },
  ];
  return <article className="transport-print-document vendor-settlement-document">{pages.map((page, index) => <section className="invoice-page vendor-settlement-page" key={index}>
    <header className="invoice-brand"><img src="/crl-logo.png" alt="CRL" /><div><h2>CHAPLE ROADLINES PVT. LTD.</h2><span>Goods Transport &amp; Logistics Services</span></div><strong>VENDOR COMMISSION<br />INVOICE</strong></header>
    <div className="vendor-invoice-meta">
      <div><span>Settlement number</span><b>{record.recordNumber}</b></div>
      <div><span>Bill date</span><b>{date(record.operationDate)}</b></div>
      <div><span>Due date</span><b>{date(record.dueDate)}</b></div>
      <div><span>Status</span><b>{record.status}</b></div>
    </div>
    <div className="vendor-invoice-party"><b>{vendor.vendorCode} - {vendor.name}</b><span>{vendor.address || ''}</span><span>GSTIN: {vendor.gstNumber || 'Unregistered'}</span></div>
    <h3>{record.title}</h3>
    <p className="vendor-invoice-reference"><b>Vendor invoice:</b> {record.documentNumber || '-'}<br /><b>Trip / manifest reference:</b> {record.reference || '-'}</p>
    {page.type === 'lr' && <><h3 className="vendor-section-title">LR details</h3><LrTable rows={page.rows} /></>}
    {page.type === 'operations' && <><h3 className="vendor-section-title">Operation details</h3><OperationTable rows={page.rows} /></>}
    {page.type === 'totals' && <>
      <h3 className="vendor-section-title">Agreed-rate commission</h3>
      <div className="vendor-commission-summary"><span>Rate basis<b>{meta.rateBasis || '-'}</b></span><span>Units<b>{meta.units || 0}</b></span><span>Agreed rate<b>{money(meta.agreedRate)}</b></span><span>Commission<b>{money(meta.commission ?? meta.baseAmount)}</b></span></div>
      <h3 className="vendor-section-title">Settlement breakdown</h3>
      <table className="vendor-totals-table"><tbody>{[['Commission', meta.commission ?? meta.baseAmount], ['Detention', meta.detention], ['Loading / unloading', meta.loading], ['Other charges', meta.otherCharge], ['Gross', meta.gross], ['TDS deduction', meta.tds], ['Advance', meta.advance], ['Total deductions', meta.deductions], ['Net payable', record.amount]].map(([caption, value]) => <tr key={caption} className={caption === 'Net payable' ? 'vendor-net-payable' : undefined}><th scope="row">{caption}</th><td>{money(value || 0)}</td></tr>)}</tbody></table>
      {(record.description || record.remarks) && <div className="vendor-invoice-notes"><b>Details / remarks</b><p>{record.description}</p><p>{record.remarks}</p></div>}
      <div className="vendor-invoice-signatures"><span>Prepared by</span><span>Vendor acknowledgement</span></div>
    </>}
    <footer className="vendor-page-footer"><span>{record.recordNumber}</span><span>Page {index + 1} of {pages.length}</span></footer>
  </section>)}</article>;
}
