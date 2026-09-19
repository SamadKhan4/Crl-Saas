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
        {c.customerType === 'CREDIT' && (
          <div className="customer-rate-summary">
            <div className="panel-heading">
              <div>
                <h2>Location-wise freight rates</h2>
                <p>Freight uses the higher of actual and volumetric weight.</p>
              </div>
              <strong>{c.creditRateCard?.length || 0} locations</strong>
            </div>
            {c.creditRateCard?.length ? (
              <div className="customer-rate-table">
                {c.creditRateCard.map((rate) => (
                  <div key={rate.location}>
                    <span><strong>{rate.location}</strong><small>{rate.transitDays} {rate.transitDays === 1 ? 'day' : 'days'} transit</small></span>
                    <strong>₹{Number(rate.ratePerKg).toLocaleString('en-IN')} / kg</strong>
                  </div>
                ))}
              </div>
            ) : (
              <p className="field-error">No credit location rate configured.</p>
            )}
            <div className="customer-charge-table">
              {[
                ['fuelRatePercent', 'Fuel charge', '%'],
                ['handlingCharges', 'Handling charge', '₹'],
                ['fodCharges', 'FOD charge', '₹'],
                ['codCharges', 'COD charge', '₹'],
                ['rovRatePercent', 'ROV', '%'],
                ['docketCharges', 'Docket charge', '₹'],
                ['gstRate', 'GST', '%'],
              ].map(([key, label, unit]) => (
                <div key={key}>
                  <small>{label}</small>
                  <strong>{unit === '₹' ? '₹' : ''}{Number(c.creditCharges?.[key] || 0).toLocaleString('en-IN')}{unit === '%' ? '%' : ''}</strong>
                </div>
              ))}
            </div>
          </div>
        )}
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
