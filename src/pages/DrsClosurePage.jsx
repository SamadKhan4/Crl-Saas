import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { FileCheck2 } from 'lucide-react';
import { drsApi } from '../api/services';
import { errorMessage } from '../api/client';
import { useAuth } from '../features/auth/AuthContext';
import { date, idOf } from '../lib/workflow';
import {
  EmptyState,
  ErrorState,
  Loadingcrleleton,
  PageHeader,
  StatusBadge,
} from '../components/common/UI';

export default function DrsClosurePage() {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ['drs', 'closure', 'OPEN'],
    queryFn: () => drsApi.list({ status: 'OPEN', limit: 100, sortBy: 'createdAt', sortOrder: 'desc' }),
  });
  const base = `/${user.role.toLowerCase()}`;

  return (
    <>
      <PageHeader
        title="DRS Closure"
        description="Upload pending PODs, verify Part B vehicle details and close completed delivery runs."
      />
      {query.isPending ? (
        <Loadingcrleleton />
      ) : query.isError ? (
        <ErrorState error={errorMessage(query.error)} retry={query.refetch} />
      ) : query.data.data.length ? (
        <section className="panel tms-pod-list">
          {query.data.data.map((drs) => {
            const total = drs.shipmentIds?.length || 0;
            const uploaded = drs.podShipmentIds?.length || 0;
            return (
              <article key={idOf(drs)}>
                <div>
                  <FileCheck2 size={20} />
                  <span>
                    <b>{drs.drsNumber}</b>
                    <small>
                      {drs.route} · {date(drs.deliveryDate)} · POD {uploaded}/{total}
                    </small>
                  </span>
                </div>
                <div className="actions">
                  <StatusBadge status={uploaded === total && total > 0 ? 'READY_TO_CLOSE' : 'POD_PENDING'} />
                  <Link className="btn secondary" to={`${base}/drs/${idOf(drs)}`} state={{ from: 'closure' }}>
                    Open closure
                  </Link>
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <EmptyState
          title="No open DRS pending closure"
          description="All delivery run sheets are closed or no DRS has been created yet."
        />
      )}
    </>
  );
}
