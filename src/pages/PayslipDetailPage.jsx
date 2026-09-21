import { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { payslipsApi } from '../api/services';
import { errorMessage } from '../api/client';
import { ErrorState, Loadingcrleleton, PageHeader, StatusBadge } from '../components/common/UI';
import TransportPdfDownload from '../components/tms/TransportPdfDownload';

const money = (value) => Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const label = (value) => String(value || '').replaceAll(/([A-Z])/g, ' $1').replaceAll('_', ' ').trim();
const rows = (parts) => Object.entries(parts || {}).filter(([key]) => key !== '_id').map(([key, value]) => [label(key), value]);

function PayslipSheet({ payslip }) {
  const employee = payslip.employeeId || {};
  const branch = payslip.branchId || {};
  return <div className="transport-print-document payslip-document">
    <header className="payslip-header"><img src="/crl-logo.png" alt="CRL" /><div><h1>PAYSLIP</h1><p>{new Date(`${payslip.salaryMonth}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</p></div></header>
    <section className="payslip-meta">
      <div><span>Employee Name</span><b>{employee.name}</b></div><div><span>Employee Code</span><b>{employee.employeeCode}</b></div>
      <div><span>Designation</span><b>{payslip.designation || '—'}</b></div><div><span>Department</span><b>{payslip.department || '—'}</b></div>
      <div><span>Branch</span><b>{branch.name || '—'}</b></div><div><span>Paid Days</span><b>{payslip.paidDays}</b></div>
      <div><span>Payslip Number</span><b>{payslip.payslipNumber}</b></div><div><span>Status</span><b>{payslip.status}</b></div>
    </section>
    <div className="payslip-tables">
      <table><thead><tr><th>Earnings</th><th>Amount (₹)</th></tr></thead><tbody>{rows(payslip.earnings).map(([name, value]) => <tr key={name}><td>{name}</td><td>{money(value)}</td></tr>)}<tr className="payslip-total"><th>Gross Earnings</th><th>{money(payslip.grossEarnings)}</th></tr></tbody></table>
      <table><thead><tr><th>Deductions</th><th>Amount (₹)</th></tr></thead><tbody>{rows(payslip.deductions).map(([name, value]) => <tr key={name}><td>{name}</td><td>{money(value)}</td></tr>)}<tr className="payslip-total"><th>Total Deductions</th><th>{money(payslip.totalDeductions)}</th></tr></tbody></table>
    </div>
    <div className="payslip-net"><span>NET PAY</span><strong>₹ {money(payslip.netPay)}</strong></div>
    {(payslip.paymentDate || payslip.paymentReference) && <p className="payslip-payment"><b>Payment:</b> {payslip.paymentDate ? new Date(payslip.paymentDate).toLocaleDateString('en-IN') : '—'} {payslip.paymentReference ? `· ${payslip.paymentReference}` : ''}</p>}
    {payslip.notes && <p className="payslip-notes"><b>Notes:</b> {payslip.notes}</p>}
    <footer>This is a computer-generated payslip.</footer>
  </div>;
}

export default function PayslipDetailPage() {
  const { id } = useParams();
  const targetRef = useRef(null);
  const query = useQuery({ queryKey: ['payslips', id], queryFn: () => payslipsApi.detail(id) });
  if (query.isPending) return <Loadingcrleleton />;
  if (query.isError) return <ErrorState error={errorMessage(query.error)} retry={query.refetch} />;
  const payslip = query.data.data;
  return <>
    <PageHeader title={payslip.payslipNumber} description={`${payslip.employeeId?.name} · ${payslip.salaryMonth}`}>
      <Link className="btn secondary" to="/hr/payslips">Back</Link>
      <button className="btn secondary" onClick={() => window.print()}><Printer size={16} /> Print</button>
      <TransportPdfDownload targetRef={targetRef} documentNumber={payslip.payslipNumber} />
      <StatusBadge status={payslip.status} />
    </PageHeader>
    <div className="transport-document-shell" ref={targetRef}><PayslipSheet payslip={payslip} /></div>
  </>;
}
