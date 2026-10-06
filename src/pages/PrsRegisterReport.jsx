import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Eye } from 'lucide-react';
import { pickupRunSheetsApi } from '../api/services';
import { errorMessage } from '../api/client';
import { useAuth } from '../features/auth/AuthContext';
import { date, idOf } from '../lib/workflow';
import PrsActions from '../components/tms/PrsActions';
import { DataTable, ErrorState, Loadingcrleleton, StatusBadge } from '../components/common/UI';

export default function PrsRegisterReport() {
  const { user } = useAuth();
  const base = `/${user.role.toLowerCase()}`;
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ['pickup-run-sheets', 'register', page],
    queryFn: () => pickupRunSheetsApi.list({ page, limit: 20, sortBy: 'createdAt', sortOrder: 'desc' }),
  });
  const rows = query.data?.data || [];
  if (query.isPending) return <Loadingcrleleton />;
  if (query.isError) return <ErrorState error={errorMessage(query.error)} retry={query.refetch} />;
  return (
      <section className="panel">
        <div className="panel-heading"><div><h2>PRS register</h2><p>Draft, approval and dispatched sheets.</p></div></div>
        <DataTable rows={rows} pagination={query.data?.pagination} onPage={setPage} empty="No PRS created yet" columns={[
          { key: 'prsNumber', label: 'PRS number' },
          { key: 'dispatchId', label: 'Dispatch ID', render: (row) => row.dispatchId || 'After dispatch' },
          { key: 'vendorName', label: 'Vendor', render: (row) => `${row.vendorCode} · ${row.vendorName}` },
          { key: 'fieldExecutiveName', label: 'FE' },
          { key: 'vehicleNumber', label: 'Vehicle' },
          { key: 'pickupDate', label: 'Pickup date', render: (row) => date(row.pickupDate) },
          { key: 'pickupCount', label: 'LRs', render: (row) => row.pickupRequestIds?.length || 0 },
          { key: 'approvalStatus', label: 'Rate approval', render: (row) => <StatusBadge status={row.approvalStatus} /> },
          { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
          { key: 'operations', label: 'Operations', render: (row) => <PrsActions prs={row} /> },
          { key: 'action', label: 'Action', render: (row) => <Link className="text-btn" to={`${base}/pickup-run-sheets/${idOf(row)}`}><Eye size={15} /> View PRS</Link> },
        ]} />
      </section>
  );
}
