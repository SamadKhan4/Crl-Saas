import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { shipmentsApi } from '../api/services';
import { errorMessage } from '../api/client';
import { useAuth } from '../features/auth/AuthContext';
import {
  PageHeader,
  StatusBadge,
  ShipmentTimeline,
  ActivityTimeline,
  Loadingcrleleton,
  ErrorState,
  DataTable,
  EmptyState,
} from '../components/common/UI';
import { date } from '../lib/workflow';
import ShipmentActions from '../components/shipment/ShipmentActions';
import DocumentPreview from '../components/shipment/DocumentPreview';
import { LrPdfDownload } from '../Template/LrPdf';
export default function ShipmentDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [tab, setTab] = useState('Overview'),
    [preview, setPreview] = useState(null);
  const query = useQuery({ queryKey: ['shipment', id], queryFn: () => shipmentsApi.detail(id) });
  const history = useQuery({ queryKey: ['history', id], queryFn: () => shipmentsApi.history(id) });
  if (query.isPending) return <Loadingcrleleton />;
  if (query.isError) return <ErrorState error={errorMessage(query.error)} retry={query.refetch} />;
  const s = query.data.data;
  return (
    <>
      <PageHeader
        title={s.lrNumber}
        description={`${s.originBranchId?.name || 'Origin'} → ${s.destinationBranchId?.name || 'Destination'}`}
      >
        <Link className="btn secondary" to={`/${user.role.toLowerCase()}/shipments`}>
          Back to shipments
        </Link>
        <LrPdfDownload shipment={s} />
      </PageHeader>
      <section className="panel shipment-summary">
        <div className="panel-heading">
          <StatusBadge status={s.currentStatus} />
          <small>Booked {date(s.createdAt)}</small>
        </div>
        <div className="summary-grid">
          {[
            ['Customer', s.customerId?.name],
            ['Current location', s.currentLocation],
            ['Expected delivery', date(s.expectedDeliveryDate)],
            ['Packages / Weight', `${s.packageCount} packages / ${s.weightKg} kg`],
          ].map(([key, value]) => (
            <div key={key}>
              <small>{key}</small>
              <strong>{value || '—'}</strong>
            </div>
          ))}
        </div>
        <ShipmentTimeline status={s.currentStatus} />
      </section>
      <ShipmentActions shipment={s} />
      <section className="panel">
        <div className="tabs" role="tablist" aria-label="Shipment details">
          {['Overview', 'Tracking History', 'Documents', 'Activity'].map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
              {t}
            </button>
          ))}
        </div>
        <div className="tab-content" role="tabpanel">
          {tab === 'Overview' && (
            <div className="detail-grid">
              {[
                [
                  'Customer',
                  [
                    ['Name', s.customerId?.name],
                    ['Code', s.customerId?.customerCode],
                    ['Email', s.customerId?.email],
                    ['Mobile', s.customerId?.mobile],
                  ],
                ],
                [
                  'Consignor & consignee',
                  [
                    ['Sender', s.senderName],
                    ['Receiver', s.receiverName],
                    ['Receiver mobile', s.receiverMobile],
                  ],
                ],
                [
                  'Shipment details',
                  [
                    ['Origin', s.originBranchId?.name],
                    ['Destination', s.destinationBranchId?.name],
                    ['Description', s.description],
                    ['Received', date(s.receivedAt)],
                  ],
                ],
              ].map(([title, fields]) => (
                <article key={title}>
                  <h3>{title}</h3>
                  <dl>
                    {fields.map(([k, v]) => (
                      <div key={k}>
                        <dt>{k}</dt>
                        <dd>{v || '—'}</dd>
                      </div>
                    ))}
                  </dl>
                </article>
              ))}
            </div>
          )}
          {tab === 'Tracking History' &&
            (history.isPending ? (
              <Loadingcrleleton />
            ) : history.isError ? (
              <ErrorState error={errorMessage(history.error)} retry={history.refetch} />
            ) : (
              <ActivityTimeline events={history.data.data} />
            ))}
          {tab === 'Activity' && (
            <EmptyState
              title="Internal activity feed unavailable"
              description="The current API exposes tracking history but does not provide an internal shipment audit feed. Use Tracking History for recorded status events."
            />
          )}
          {tab === 'Documents' && (
            <DataTable
              rows={s.documents || []}
              empty="No LR documents uploaded"
              columns={[
                { key: 'originalFileName', label: 'Document' },
                { key: 'version', label: 'Version' },
                { key: 'createdAt', label: 'Uploaded', render: (r) => date(r.createdAt) },
                {
                  key: 'verificationStatus',
                  label: 'Status',
                  render: (r) => <StatusBadge status={r.verificationStatus} />,
                },
                { key: 'rejectionReason', label: 'Rejection reason' },
                {
                  key: 'preview',
                  label: 'Actions',
                  render: (r) => (
                    <button className="text-btn" onClick={() => setPreview(r)}>
                      Preview / download
                    </button>
                  ),
                },
              ]}
            />
          )}
        </div>
      </section>
      {preview && (
        <DocumentPreview shipmentId={id} document={preview} onClose={() => setPreview(null)} />
      )}
    </>
  );
}
