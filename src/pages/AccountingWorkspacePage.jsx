import { useQuery } from '@tanstack/react-query';
import { accountingSummaryApi } from '../api/services';
import { errorMessage } from '../api/client';
import { ErrorState, Loadingcrleleton, StatCard } from '../components/common/UI';
import TmsModulePage from './TmsModulePage';
const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
export default function AccountingWorkspacePage() {
  const query = useQuery({ queryKey: ['accounting-summary'], queryFn: () => accountingSummaryApi.summary() });
  return <>{query.isPending ? <Loadingcrleleton /> : query.isError ? <ErrorState error={errorMessage(query.error)} retry={query.refetch} /> : <div className="stats-grid"><StatCard label="Client billed" value={money(query.data.data.billed)} /><StatCard label="Received" value={money(query.data.data.received)} /><StatCard label="Receivable" value={money(query.data.data.receivable)} /><StatCard label="Vendor payable" value={money(query.data.data.payable)} /><StatCard label="Expenses" value={money(query.data.data.expense)} /><StatCard label="GST / TDS tracked" value={money(Number(query.data.data.vendorTax || 0) + Number(query.data.data.expenseTax || 0))} /></div>}<TmsModulePage /></>;
}
