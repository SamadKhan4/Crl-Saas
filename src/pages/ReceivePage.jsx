import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { shipmentsApi } from '../api/services';
import { errorMessage } from '../api/client';
import {
  PageHeader,
  Loadingcrleleton,
  ErrorState,
  EmptyState,
  StatusBadge,
} from '../components/common/UI';
import ShipmentActions from '../components/shipment/ShipmentActions';
export default function ReceivePage() {
  const [input, setInput] = useState(''),
    [lr, setLr] = useState('');
  const query = useQuery({
    queryKey: ['shipments', 'receive', lr],
    queryFn: () => shipmentsApi.list({ lrNumber: lr }),
    enabled: !!lr,
  });
  return (
    <>
      <PageHeader
        title="Receive parcel"
        description="Find the LR, check the destination, and confirm receipt."
      />
      <section className="panel form-section">
        <form
          className="tracking-form"
          onSubmit={(e) => {
            e.preventDefault();
            setLr(input.trim().toUpperCase());
          }}
        >
          <label className="sr-only" htmlFor="receive-lr">
            LR number
          </label>
          <input
            id="receive-lr"
            required
            minLength={5}
            maxLength={50}
            placeholder="Enter LR number"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button className="btn">Find shipment</button>
        </form>
      </section>
      {lr &&
        (query.isPending ? (
          <Loadingcrleleton />
        ) : query.isError ? (
          <ErrorState error={errorMessage(query.error)} retry={query.refetch} />
        ) : !query.data.data.length ? (
          <EmptyState
            title="No shipment found"
            description="Check the LR number and your branch access."
          />
        ) : (
          query.data.data.map((s) => (
            <section key={s._id} className="panel form-section">
              <h2>{s.lrNumber}</h2>
              <StatusBadge status={s.currentStatus} />
              <div className="summary-grid">
                <div>
                  <small>Customer</small>
                  <strong>{s.customerId?.name}</strong>
                </div>
                <div>
                  <small>Origin</small>
                  <strong>{s.originBranchId?.name}</strong>
                </div>
                <div>
                  <small>Expected destination / receiving branch</small>
                  <strong>{s.destinationBranchId?.name}</strong>
                </div>
              </div>
              <ShipmentActions shipment={s} only={['receive']} />
              {s.currentStatus !== 'IN_TRANSIT' && <p>This shipment is not awaiting receipt.</p>}
            </section>
          ))
        ))}
    </>
  );
}
