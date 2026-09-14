import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../features/auth/AuthContext';
import { shipmentsApi } from '../api/services';
import { errorMessage } from '../api/client';
import { PageHeader, Loadingcrleleton, ErrorState } from '../components/common/UI';
import ShipmentTable from '../components/shipment/ShipmentTable';
export default function DocumentsPage() {
  const { user } = useAuth();
  const [status, setStatus] = useState('LR_IMAGE_UPLOADED'),
    [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ['documents', status, page],
    queryFn: () => shipmentsApi.list({ status, page }),
  });
  return (
    <>
      <PageHeader
        title="Documents"
        description="Find a shipment to upload, review, or download its LR documents."
      />
      <section className="panel">
        <div className="tabs">
          {[
            ['LR_IMAGE_UPLOADED', 'Pending verification'],
            ['LR_IMAGE_VERIFIED', 'Verified shipments'],
            ['RECEIVED', 'Awaiting upload'],
          ].map(([value, name]) => (
            <button
              key={value}
              aria-pressed={status === value}
              className={status === value ? 'active' : ''}
              onClick={() => {
                setStatus(value);
                setPage(1);
              }}
            >
              {name}
            </button>
          ))}
        </div>
        <div className="notice">
          Open a shipment to view every document version, including rejected files. This list groups
          shipments by their current workflow status.
        </div>
        {query.isPending ? (
          <Loadingcrleleton />
        ) : query.isError ? (
          <ErrorState error={errorMessage(query.error)} retry={query.refetch} />
        ) : (
          <ShipmentTable
            base={`/${user.role.toLowerCase()}`}
            rows={query.data.data}
            pagination={query.data.pagination}
            onPage={setPage}
          />
        )}
      </section>
    </>
  );
}
