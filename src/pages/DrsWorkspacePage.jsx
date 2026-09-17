import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, FileCheck2, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '../api/client';
import { drsApi } from '../api/services';
import { useAuth } from '../features/auth/AuthContext';
import { date, idOf, validateFile } from '../lib/workflow';
import {
  EmptyState,
  ErrorState,
  FormField,
  Loadingcrleleton,
  PageHeader,
  StatusBadge,
} from '../components/common/UI';

export default function DrsWorkspacePage() {
  const { id } = useParams();
  const { user } = useAuth();
  const cache = useQueryClient();
  const query = useQuery({ queryKey: ['drs', id], queryFn: () => drsApi.detail(id) });
  const [vehicle, setVehicle] = useState('');
  const [eWayBillNo, setEWayBillNo] = useState('');
  const [files, setFiles] = useState({});
  const [error, setError] = useState('');
  const refresh = () => {
    cache.invalidateQueries({ queryKey: ['drs', id] });
    cache.invalidateQueries({ queryKey: ['drs'] });
  };
  const action = useMutation({
    mutationFn: async ({ type, shipment }) => {
      if (type === 'vehicle')
        return api.patch(`/drs/${id}/vehicle`, {
          vehicleNumber: vehicle,
          ...(eWayBillNo && { partB: [{ eWayBillNo, vehicleNumber: vehicle }] }),
        });
      if (type === 'close') return api.post(`/drs/${id}/close`);
      const file = files[idOf(shipment)];
      const invalid = validateFile(file);
      if (invalid) throw new Error(invalid);
      const body = new FormData();
      body.append('pod', file);
      return api.post(`/drs/${id}/pod/${idOf(shipment)}`, body);
    },
    onSuccess: (_data, variables) => {
      toast.success(
        variables.type === 'pod'
          ? 'POD uploaded'
          : variables.type === 'close'
            ? 'DRS closed'
            : 'Vehicle details updated',
      );
      setError('');
      refresh();
    },
    onError: (reason) => setError(errorMessage(reason)),
  });
  if (query.isPending) return <Loadingcrleleton />;
  if (query.isError) return <ErrorState error={errorMessage(query.error)} retry={query.refetch} />;
  const drs = query.data.data;
  const uploaded = new Set((drs.podShipmentIds || []).map(idOf));
  const complete = drs.shipmentIds?.length > 0 && uploaded.size === drs.shipmentIds.length;
  const base = `/${user.role.toLowerCase()}`;
  return (
    <>
      <PageHeader title={drs.drsNumber} description={`${drs.route} · ${date(drs.deliveryDate)}`}>
        <Link className="btn secondary" to={`${base}/drs`}>
          Back to DRS
        </Link>
        <StatusBadge status={drs.status} />
      </PageHeader>
      <section className="panel form-section">
        <div className="section-title">
          <span>
            <Truck size={16} />
          </span>
          <div>
            <h2>Vehicle & E-way bill Part B</h2>
            <p>Vehicle number can be corrected manually while this DRS is open.</p>
          </div>
        </div>
        <div className="form-grid">
          <FormField
            label="Vehicle number"
            value={vehicle || drs.vehicleNumber}
            onChange={(event) => setVehicle(event.target.value.toUpperCase())}
            disabled={drs.status !== 'OPEN'}
          />
          <FormField
            label="E-way bill number"
            value={eWayBillNo}
            onChange={(event) => setEWayBillNo(event.target.value)}
            disabled={drs.status !== 'OPEN'}
          />
        </div>
        <button
          className="btn"
          disabled={drs.status !== 'OPEN' || action.isPending}
          onClick={() => action.mutate({ type: 'vehicle' })}
        >
          Update vehicle / Part B
        </button>
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>POD closure checklist</h2>
            <p>
              {uploaded.size} of {drs.shipmentIds?.length || 0} POD files uploaded
            </p>
          </div>
        </div>
        {drs.shipmentIds?.length ? (
          <div className="tms-pod-list">
            {drs.shipmentIds.map((shipment) => {
              const done = uploaded.has(idOf(shipment));
              return (
                <article key={idOf(shipment)}>
                  <div>
                    {done ? <CheckCircle2 size={20} /> : <FileCheck2 size={20} />}
                    <span>
                      <b>{shipment.lrNumber}</b>
                      <small>
                        {shipment.receiverName} · {shipment.currentLocation}
                      </small>
                    </span>
                  </div>
                  {done ? (
                    <StatusBadge status="POD_UPLOADED" />
                  ) : (
                    <div className="actions">
                      <input
                        type="file"
                        accept=".jpg,.jpeg,.png,.webp,.pdf"
                        onChange={(event) =>
                          setFiles((current) => ({
                            ...current,
                            [idOf(shipment)]: event.target.files?.[0],
                          }))
                        }
                      />
                      <button
                        className="btn secondary"
                        disabled={action.isPending || drs.status !== 'OPEN'}
                        onClick={() => action.mutate({ type: 'pod', shipment })}
                      >
                        Upload POD
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState title="No LRs on this DRS" />
        )}
        <div className="tms-close-bar">
          <span>DRS can close only after every LR has a POD.</span>
          <button
            className="btn"
            disabled={!complete || drs.status !== 'OPEN' || action.isPending}
            onClick={() => action.mutate({ type: 'close' })}
          >
            Close DRS
          </button>
        </div>
        {error && (
          <p className="field-error tms-error" role="alert">
            {error}
          </p>
        )}
      </section>
    </>
  );
}
