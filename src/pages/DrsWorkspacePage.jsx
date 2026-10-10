import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useParams } from 'react-router-dom';
import { CheckCircle2, FileCheck2, Printer, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '../api/client';
import { lastMileApi } from '../api/services';
import { DeliveryManifestSheet } from '../components/tms/TransportPrintLayouts';
import TransportPdfDownload from '../components/tms/TransportPdfDownload';
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
  const location = useLocation();
  const printRef = useRef(null);
  const { user } = useAuth();
  const cache = useQueryClient();
  const query = useQuery({ queryKey: ['drs', id], queryFn: () => lastMileApi.drs.detail(id) });
  const [vehicle, setVehicle] = useState('');
  const [eWayBillNo, setEWayBillNo] = useState('');
  const [files, setFiles] = useState({});
  const [proofs, setProofs] = useState({});
  const [failures, setFailures] = useState({});
  const [error, setError] = useState('');
  const refresh = () => {
    cache.invalidateQueries({ queryKey: ['drs', id] });
    cache.invalidateQueries({ queryKey: ['drs'] });
  };
  const action = useMutation({
    mutationFn: async ({ type, shipment, outcome }) => {
      if (type === 'vehicle')
        return api.patch(`/drs/${id}/vehicle`, {
          vehicleNumber: vehicle,
          ...(eWayBillNo && { partB: [{ eWayBillNo, vehicleNumber: vehicle }] }),
        });
      if (type === 'close') return lastMileApi.closeDrs(id);
      if (type === 'attempt') return lastMileApi.attempt(id, idOf(shipment), {
        outcome,
        failureReason: outcome === 'DELIVERED' ? undefined : failures[idOf(shipment)]?.trim(),
        nextAction: outcome === 'REATTEMPT' ? 'Return to destination hub for reattempt' : undefined,
      });
      const file = files[idOf(shipment)];
      const invalid = validateFile(file);
      if (invalid) throw new Error(invalid);
      const body = new FormData();
      body.append('pod', file);
      const proof = proofs[idOf(shipment)] || {};
      if (!proof.receiverName?.trim()) throw new Error('Enter the actual receiver name before uploading POD');
      body.append('receiverName', proof.receiverName.trim());
      body.append('receiverMobile', proof.receiverMobile || shipment.receiverMobile || '');
      body.append('otpReference', proof.otpReference || '');
      body.append('signatureName', proof.signatureName || proof.receiverName);
      body.append('remarks', proof.remarks || '');
      body.append('deliveredAt', new Date().toISOString());
      return api.post(`/last-mile/drs/${id}/pod/${idOf(shipment)}`, body);
    },
    onSuccess: (_data, variables) => {
      toast.success(
        variables.type === 'pod'
          ? 'POD uploaded'
          : variables.type === 'attempt'
            ? 'Delivery attempt recorded'
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
  const itemByShipment = new Map((drs.items || []).map((item) => [idOf(item.shipmentId), item]));
  const attemptsComplete = drs.shipmentIds?.length > 0 && drs.shipmentIds.every((shipment) => itemByShipment.get(idOf(shipment))?.attemptStatus !== 'PENDING');
  const complete = attemptsComplete && drs.shipmentIds.every((shipment) => itemByShipment.get(idOf(shipment))?.attemptStatus !== 'DELIVERED' || uploaded.has(idOf(shipment)));
  const base = `/${user.role.toLowerCase()}`;
  const canClose = ['ADMIN', 'MANAGER'].includes(user.role);
  return (
    <>
      <PageHeader title={drs.drsNumber} description={`${drs.route} · ${date(drs.deliveryDate)}`}>
        <Link className="btn secondary" to={`${base}/${location.state?.from === 'closure' ? 'drs-closure' : 'drs'}`}>
          Back to {location.state?.from === 'closure' ? 'DRS closure' : 'DRS'}
        </Link>
        <button className="btn secondary" onClick={() => window.print()}><Printer size={16} /> Print DRS</button>
        <TransportPdfDownload targetRef={printRef} documentNumber={drs.drsNumber} label="Download DRS PDF" />
        <StatusBadge status={drs.status} />
      </PageHeader>
      <div className="transport-document-shell" ref={printRef}>
        <DeliveryManifestSheet record={drs} />
      </div>
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
              const deliveryItem = itemByShipment.get(idOf(shipment));
              const attempted = deliveryItem?.attemptStatus && deliveryItem.attemptStatus !== 'PENDING';
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
                  {!attempted ? (
                    <div className="tms-epod-fields">
                      <input aria-label={`Undelivered reason for ${shipment.lrNumber}`} placeholder="Reason if undelivered" value={failures[idOf(shipment)] || ''} onChange={(event) => setFailures((current) => ({ ...current, [idOf(shipment)]: event.target.value }))} />
                      <button className="btn secondary" disabled={action.isPending || drs.workflowStatus !== 'DISPATCHED'} onClick={() => action.mutate({ type: 'attempt', shipment, outcome: 'DELIVERED' })}>Delivered</button>
                      <button className="btn secondary" disabled={action.isPending || drs.workflowStatus !== 'DISPATCHED' || !failures[idOf(shipment)]?.trim()} onClick={() => action.mutate({ type: 'attempt', shipment, outcome: 'UNDELIVERED' })}>Undelivered</button>
                      <button className="btn secondary" disabled={action.isPending || drs.workflowStatus !== 'DISPATCHED' || !failures[idOf(shipment)]?.trim()} onClick={() => action.mutate({ type: 'attempt', shipment, outcome: 'REATTEMPT' })}>Reattempt</button>
                    </div>
                  ) : done ? (
                    <StatusBadge status="POD_UPLOADED" />
                  ) : deliveryItem?.attemptStatus !== 'DELIVERED' ? (
                    <StatusBadge status={deliveryItem?.attemptStatus} />
                  ) : (
                    <div className="tms-epod-fields">
                      <input
                        aria-label={`Receiver name for ${shipment.lrNumber}`}
                        placeholder="Actual receiver name *"
                        value={proofs[idOf(shipment)]?.receiverName || ''}
                        onChange={(event) => setProofs((current) => ({ ...current, [idOf(shipment)]: { ...current[idOf(shipment)], receiverName: event.target.value } }))}
                      />
                      <input
                        aria-label={`Receiver mobile for ${shipment.lrNumber}`}
                        placeholder="Receiver mobile"
                        value={proofs[idOf(shipment)]?.receiverMobile || ''}
                        onChange={(event) => setProofs((current) => ({ ...current, [idOf(shipment)]: { ...current[idOf(shipment)], receiverMobile: event.target.value } }))}
                      />
                      <input
                        aria-label={`OTP reference for ${shipment.lrNumber}`}
                        placeholder="OTP / delivery reference"
                        value={proofs[idOf(shipment)]?.otpReference || ''}
                        onChange={(event) => setProofs((current) => ({ ...current, [idOf(shipment)]: { ...current[idOf(shipment)], otpReference: event.target.value } }))}
                      />
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
                        disabled={action.isPending || drs.status !== 'OPEN' || !proofs[idOf(shipment)]?.receiverName?.trim() || !files[idOf(shipment)]}
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
          <span>Close after every LR has an outcome and every delivered LR has a POD.</span>
          {canClose && <button
            className="btn"
            disabled={!complete || drs.status !== 'OPEN' || action.isPending}
            onClick={() => action.mutate({ type: 'close' })}
          >
            Close DRS
          </button>}
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
