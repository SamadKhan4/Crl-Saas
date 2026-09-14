import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { DataTable, StatusBadge } from '../common/UI';
import { date, idOf, actionsFor } from '../../lib/workflow';
import { useAuth } from '../../features/auth/AuthContext';
import ShipmentActions from './ShipmentActions';
const tableActions = [
  'dispatch',
  'cancel',
  'receive',
  'upload',
  'verify',
  'reject',
  'complete',
  'close',
  'upload-token',
];
export default function ShipmentTable({ base, compact = false, ...props }) {
  const { user } = useAuth();
  const columns = [
    {
      key: 'lrNumber',
      label: 'LR number',
      sort: 'lrNumber',
      render: (r) => (
        <Link className="lr-link" to={`${base}/shipments/${idOf(r)}`}>
          {r.lrNumber}
        </Link>
      ),
    },
    {
      key: 'customer',
      label: 'Customer',
      render: (r) => (
        <div>
          <strong>{r.customerId?.name || '—'}</strong>
          <small>{r.customerId?.customerCode}</small>
        </div>
      ),
    },
    {
      key: 'route',
      label: 'Route',
      render: (r) => (
        <div>
          {r.originBranchId?.city || r.originBranchId?.name || '—'} <span className="muted">→</span>{' '}
          {r.destinationBranchId?.city || r.destinationBranchId?.name || '—'}
        </div>
      ),
    },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.currentStatus} /> },
    ...(!compact
      ? [
          { key: 'location', label: 'Current location', render: (r) => r.currentLocation || '—' },
          { key: 'date', label: 'Booked', sort: 'createdAt', render: (r) => date(r.createdAt) },
          {
            key: 'delivery',
            label: 'Expected delivery',
            sort: 'expectedDeliveryDate',
            render: (r) => date(r.expectedDeliveryDate),
          },
        ]
      : []),
    {
      key: 'actions',
      label: 'Actions',
      render: (r) => (
        <div>
          <Link
            className="table-action"
            aria-label={`View ${r.lrNumber}`}
            to={`${base}/shipments/${idOf(r)}`}
          >
            View <ArrowUpRight size={14} />
          </Link>
          {!compact && actionsFor(r, user).some((action) => tableActions.includes(action)) && (
            <details className="shipment-row-actions">
              <summary>More actions</summary>
              <ShipmentActions shipment={r} only={tableActions} />
            </details>
          )}
        </div>
      ),
    },
  ];
  return <DataTable {...props} columns={columns} empty="No shipments found" />;
}
