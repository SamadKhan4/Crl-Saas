import { useQuery } from '@tanstack/react-query';
import { Banknote, CircleDollarSign, Clock3, ReceiptIndianRupee } from 'lucide-react';
import { errorMessage } from '../api/client';
import { invoicesApi, receivablesApi } from '../api/services';
import { date } from '../lib/workflow';
import {
  DataTable,
  ErrorState,
  Loadingcrleleton,
  PageHeader,
  StatCard,
  StatusBadge,
} from '../components/common/UI';

const money = (value) =>
  Number(value || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
export default function ReceivablesPage() {
  const summary = useQuery({ queryKey: ['receivables'], queryFn: () => receivablesApi.summary() });
  const invoices = useQuery({
    queryKey: ['invoices', 'outstanding'],
    queryFn: () => invoicesApi.list({ limit: 100 }),
  });
  if (summary.isPending || invoices.isPending) return <Loadingcrleleton />;
  if (summary.isError || invoices.isError)
    return (
      <ErrorState
        error={errorMessage(summary.error || invoices.error)}
        retry={() => {
          summary.refetch();
          invoices.refetch();
        }}
      />
    );
  const totals = summary.data.data;
  const rows = invoices.data.data.filter((row) => ['ISSUED', 'PART_PAID'].includes(row.status));
  return (
    <>
      <PageHeader
        title="Outstanding & receivables"
        description="Live credit-client billing, collections and overdue exposure."
      />
      <div className="stats-grid tms-stats">
        <StatCard label="Open invoices" value={totals.invoiceCount} icon={ReceiptIndianRupee} />
        <StatCard label="Billed" value={money(totals.billed)} icon={CircleDollarSign} />
        <StatCard label="Received" value={money(totals.received)} icon={Banknote} />
        <StatCard label="Outstanding" value={money(totals.outstanding)} icon={Clock3} />
        <StatCard label="Overdue" value={money(totals.overdue)} icon={Clock3} />
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Open invoices</h2>
            <p>Issue money receipts to reduce allocated balances.</p>
          </div>
        </div>
        <DataTable
          rows={rows}
          columns={[
            { key: 'invoiceNumber', label: 'Invoice' },
            { key: 'customer', label: 'Customer', render: (row) => row.customerId?.name },
            {
              key: 'status',
              label: 'Status',
              render: (row) => <StatusBadge status={row.status} />,
            },
            { key: 'totalAmount', label: 'Total', render: (row) => money(row.totalAmount) },
            {
              key: 'balanceAmount',
              label: 'Outstanding',
              render: (row) => <b>{money(row.balanceAmount)}</b>,
            },
            { key: 'dueDate', label: 'Due', render: (row) => date(row.dueDate) },
          ]}
        />
      </section>
    </>
  );
}
