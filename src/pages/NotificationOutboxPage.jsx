import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { get, post, errorMessage } from '../api/client';
import { DataTable, ErrorState, Loadingcrleleton, PageHeader, StatusBadge } from '../components/common/UI';
import { date } from '../lib/workflow';
export default function NotificationOutboxPage() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['notification-outbox'], queryFn: () => get('/notification-outbox', { limit: 100 }) });
  const retry = useMutation({ mutationFn: (id) => post(`/notification-outbox/${id}/retry`, {}), onSuccess: () => { toast.success('Notification queued'); client.invalidateQueries({ queryKey: ['notification-outbox'] }); }, onError: (error) => toast.error(errorMessage(error)) });
  return <><PageHeader title="Notification Outbox" description="Automatic shipment alerts queued for WhatsApp, SMS and email." />
    <section className="panel">{query.isPending ? <Loadingcrleleton /> : query.isError ? <ErrorState error={errorMessage(query.error)} retry={query.refetch} /> : <DataTable rows={query.data.data} columns={[{ key: 'createdAt', label: 'Queued', render: (r) => date(r.createdAt) }, { key: 'event', label: 'Event' }, { key: 'lr', label: 'LR', render: (r) => r.shipmentId?.lrNumber || '—' }, { key: 'recipientName', label: 'Recipient' }, { key: 'channels', label: 'Channels', render: (r) => r.channels?.join(', ') }, { key: 'subject', label: 'Message' }, { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> }, { key: 'action', label: 'Action', render: (r) => ['FAILED', 'PARTIAL'].includes(r.status) && <button className="text-btn" disabled={retry.isPending} onClick={() => retry.mutate(r.id || r._id)}>Retry</button> }]} />}</section>
  </>;
}
