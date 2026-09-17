import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { customersApi, shipmentsApi } from '../api/services';
import { errorMessage } from '../api/client';
import { useAuth } from '../features/auth/AuthContext';
import { useList } from '../hooks/useList';
import { PageHeader, Loadingcrleleton, ErrorState, StatusBadge } from '../components/common/UI';
import ShipmentTable from '../components/shipment/ShipmentTable';
export default function CustomerDetailPage() {
  const { id } = useParams(),
    { user } = useAuth();
  const customer = useQuery({
    queryKey: ['customers', id],
    queryFn: () => customersApi.detail(id),
  });
  const { query, update } = useList('shipments', shipmentsApi, { customerId: id });
  if (customer.isPending) return <Loadingcrleleton />;
  if (customer.isError)
    return <ErrorState error={errorMessage(customer.error)} retry={customer.refetch} />;
  const c = customer.data.data;
  return (
    <>
      <PageHeader title={c.name} description={c.customerCode} />
      <section className="panel form-section">
        <StatusBadge status={c.status} />
        <dl className="detail-grid">
          {[
            'customerType',
            'companyName',
            'mobile',
            'email',
            'address',
            'city',
            'state',
            'pincode',
            'gstNumber',
          ].map((k) => (
            <div key={k}>
              <dt>{k.replace(/([A-Z])/g, ' $1')}</dt>
              <dd>{c[k] || '—'}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="panel">
        <div className="panel-heading">
          <h2>Shipments {query.data?.pagination && `(${query.data.pagination.total})`}</h2>
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
            onPage={(p) => update('page', p)}
          />
        )}
      </section>
    </>
  );
}
