import { useState } from 'react';
import DeliveryRouteField from '../components/tms/DeliveryRouteField';
import { DeliveryManifestSheet } from '../components/tms/TransportPrintLayouts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { ClipboardCheck, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { errorMessage } from '../api/client';
import { lastMileApi, middleMileApi, usersApi } from '../api/services';
import { useAuth } from '../features/auth/AuthContext';
import { idOf } from '../lib/workflow';
import { DataTable, ErrorState, Loadingcrleleton, Modal, PageHeader, StatusBadge } from '../components/common/UI';

const lrLabel = (shipment) => shipment?.lrNumber || idOf(shipment);
const rows = (query) => query.data?.data || [];
const busyLabel = (pending, text) => pending ? 'Saving…' : text;

function Arrivals() {
  const cache = useQueryClient();
  const query = useQuery({ queryKey: ['last-mile-pending-arrivals'], queryFn: () => middleMileApi.trips.list({ status: 'DISPATCHED', limit: 100 }) });
  const arrive = useMutation({
    mutationFn: (tripId) => middleMileApi.arriveTrip(tripId),
    onSuccess: () => { toast.success('Trip marked arrived'); cache.invalidateQueries({ queryKey: ['last-mile-pending-arrivals'] }); cache.invalidateQueries({ queryKey: ['last-mile-arrivals'] }); cache.invalidateQueries({ queryKey: ['middle-mile-trips'] }); },
    onError: (error) => toast.error(errorMessage(error)),
  });
  return <><PageHeader title="Trip Arrival" description="Mark dispatched Middle Mile trips as arrived at the destination hub." />
    <section className="panel">{query.isPending ? <Loadingcrleleton /> : query.isError ? <ErrorState error={errorMessage(query.error)} retry={query.refetch} /> : <DataTable rows={rows(query)} empty="No dispatched trips pending arrival" columns={[
      { key: 'trip', label: 'Trip', render: (row) => row.tripNumber },
      { key: 'vehicle', label: 'Vehicle / Driver', render: (row) => `${row.vehicleNumber} / ${row.driverName}` },
      { key: 'from', label: 'Movement', render: (row) => `${row.fromHubId?.name || row.origin} → ${row.toHubId?.name || row.destination}` },
      { key: 'lrs', label: 'LRs / Boxes', render: (row) => `${row.shipmentIds?.length || 0} / ${row.totalPackages || 0}` },
      { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.workflowStatus} /> },
      { key: 'action', label: 'Action', render: (row) => <button className="btn secondary" disabled={arrive.isPending} onClick={() => arrive.mutate(idOf(row))}>Mark Arrived</button> },
    ]} />}</section></>;
}

function ReadyForClosure() {
  const cache = useQueryClient();
  const query = useQuery({ queryKey: ['last-mile-arrivals'], queryFn: () => lastMileApi.arrivals({ limit: 100 }) });
  const create = useMutation({
    mutationFn: (tripId) => lastMileApi.tallies.create({ tripId }),
    onSuccess: () => { toast.success('Unloading tally created'); cache.invalidateQueries({ queryKey: ['last-mile-arrivals'] }); cache.invalidateQueries({ queryKey: ['unloading-tallies'] }); },
    onError: (error) => toast.error(errorMessage(error)),
  });
  return <><PageHeader title="Trip Closure" description="Select an arrived trip, open its manifest and verify LR-wise received boxes." />
    <section className="panel"><div className="panel-heading"><h2>Arrived trips</h2></div>{query.isPending ? <Loadingcrleleton /> : query.isError ? <ErrorState error={errorMessage(query.error)} retry={query.refetch} /> : <DataTable rows={rows(query)} empty="No arrived trips waiting to process" columns={[
      { key: 'trip', label: 'Trip', render: (row) => row.tripNumber },
      { key: 'vehicle', label: 'Vehicle / Driver', render: (row) => `${row.vehicleNumber} / ${row.driverName}` },
      { key: 'from', label: 'Movement', render: (row) => `${row.fromHubId?.name || row.origin} → ${row.toHubId?.name || row.destination}` },
      { key: 'lrs', label: 'LRs / Packages', render: (row) => `${row.shipmentIds?.length || 0} / ${row.totalPackages || 0}` },
      { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.workflowStatus} /> },
      { key: 'action', label: 'Action', render: (row) => <button className="btn secondary" disabled={create.isPending} onClick={() => create.mutate(idOf(row))}>Process Trip</button> },
    ]} />}</section><Tallies mode="closure" /></>;
}

function Tallies({ mode = 'closure' }) {
  const cache = useQueryClient(); const [selectedRecord, setSelected] = useState(null);
  const [exceptions, setExceptions] = useState({}); const [checked, setChecked] = useState([]);
  const query = useQuery({ queryKey: ['unloading-tallies', mode], queryFn: () => lastMileApi.tallies.list({ limit: 100 }) });
  const detail = useQuery({ queryKey: ['unloading-tally', idOf(selectedRecord)], queryFn: () => lastMileApi.tallies.detail(idOf(selectedRecord)), enabled: Boolean(selectedRecord) });
  const selected = detail.data?.data || rows(query).find((row) => idOf(row) === idOf(selectedRecord)) || selectedRecord;
  const refresh = () => { cache.invalidateQueries({ queryKey: ['unloading-tallies'] }); cache.invalidateQueries({ queryKey: ['unloading-tally'] }); cache.invalidateQueries({ queryKey: ['last-mile-arrivals'] }); cache.invalidateQueries({ queryKey: ['last-mile-drs-inventory'] }); };
  const action = useMutation({
    mutationFn: ({ type, tally, payload }) => type === 'complete' ? lastMileApi.completeTally(idOf(tally), payload) : type === 'qc' ? lastMileApi.updateQc(idOf(tally), payload.shipmentId, payload.body) : lastMileApi.inward(idOf(tally), payload),
    onSuccess: (_data, variables) => { toast.success({ complete: 'Trip closed; QC is pending', qc: 'QC / DEPS saved', inward: 'QC submitted; destination inward completed' }[variables.type]); if (variables.type === 'inward') setSelected(null); refresh(); },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const statusAllowed = (row) => mode === 'closure' ? ['UNLOADING', 'QC_PENDING', 'READY_FOR_INWARD'].includes(row.status) : row.status === 'READY_FOR_INWARD';
  const visible = rows(query).filter(statusAllowed);
  const title = mode === 'closure' ? 'Trips in Process / QC / DEPS' : 'Destination Inward';
  const updateException = (shipmentId, patch) => {
    setExceptions((current) => ({ ...current, [shipmentId]: { ...current[shipmentId], ...patch } }));
    setChecked((current) => current.filter((value) => value !== shipmentId));
  };
  const closeTrip = () => {
    const payload = selected.items.map((item) => {
      const shipmentId = idOf(item.shipmentId);
      const entry = exceptions[shipmentId] || {};
      return {
        shipmentId,
        receivedPackages: entry.receivedPackages ?? (item.receivedPackages || item.expectedPackages),
        damagedPackages: entry.damagedPackages || 0,
        receiptRemarks: entry.receiptRemarks?.trim(),
      };
    });
    action.mutate({ type: 'complete', tally: selected, payload });
  };
  return <>{mode !== 'closure' && <PageHeader title={title} description="Only QC-passed LRs can enter delivery inventory." />}
    <section className="panel">{mode === 'closure' && <div className="panel-heading"><h2>{title}</h2></div>}{query.isPending ? <Loadingcrleleton /> : query.isError ? <ErrorState error={errorMessage(query.error)} retry={query.refetch} /> : <DataTable rows={visible} empty={`No ${title.toLowerCase()} records`} columns={[
      { key: 'number', label: 'Tally', render: (row) => row.tallyNumber }, { key: 'trip', label: 'Trip', render: (row) => row.tripId?.tripNumber || '—' },
      { key: 'count', label: 'LRs / Boxes', render: (row) => `${row.totalLrs} / ${row.totalPackages}` },
      { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
      { key: 'action', label: 'Action', render: (row) => mode === 'inward' ? <button className="btn" disabled={action.isPending} onClick={() => action.mutate({ type: 'inward', tally: row })}>Confirm Inward</button> : <button className="btn secondary" onClick={() => { setSelected(row); setExceptions({}); setChecked([]); }}>View</button> },
    ]} />}</section>
    {selected && <Modal title={`${selected.tripId?.tripNumber || selected.tallyNumber} - ${selected.status === 'UNLOADING' ? 'Trip Closure' : 'QC / DEPS'}`} onClose={() => setSelected(null)}>
      <div className="last-mile-workspace">
      {detail.isPending ? <Loadingcrleleton /> : detail.isError ? <ErrorState error={errorMessage(detail.error)} retry={detail.refetch} /> : <>
      <div className="last-mile-summary">
        <div><span>Tally</span><strong>{selected.tallyNumber}</strong></div>
        <div><span>LRs / Boxes</span><strong>{selected.totalLrs} / {selected.totalPackages}</strong></div>
        <div><span>Status</span><StatusBadge status={selected.status} /></div>
      </div>
      {selected.status === 'UNLOADING' ? <>
        <div className="last-mile-modal-body"><div className="tms-pod-list last-mile-manifests">{(selected.tripId?.manifestIds || []).map((manifest) => <details key={idOf(manifest)}><summary><span><b>{manifest.manifestNumber}</b><small>Manifest</small></span><strong>{manifest.totalLrs} LRs · {manifest.totalPackages} boxes</strong></summary>{(manifest.shipmentIds || []).map((shipment) => { const item = selected.items.find((row) => idOf(row.shipmentId) === idOf(shipment)); if (!item) return null; const shipmentId = idOf(shipment); return <LrReceiptRow key={shipmentId} shipment={shipment} item={item} entry={exceptions[shipmentId] || {}} verified={checked.includes(shipmentId)} onChange={(patch) => updateException(shipmentId, patch)} onVerify={(value) => setChecked((current) => value ? [...current, shipmentId] : current.filter((id) => id !== shipmentId))} />; })}</details>)}</div></div>
        <div className="last-mile-modal-footer"><p>Enter a remark and verify every LR after checking received boxes.</p><button className="btn" disabled={action.isPending || !selected.items?.length || checked.length !== selected.items.length} onClick={closeTrip}>{busyLabel(action.isPending, 'Close Trip')}</button></div>
      </> : <><div className="last-mile-modal-body"><div className="tms-pod-list last-mile-qc-list">{selected.items?.map((item) => <QcRow key={idOf(item.shipmentId)} item={item} pending={action.isPending} onSave={(body) => action.mutate({ type: 'qc', tally: selected, payload: { shipmentId: idOf(item.shipmentId), body } })} />)}</div></div>
        <div className="last-mile-modal-footer"><p>{selected.status === 'READY_FOR_INWARD' ? 'All LRs passed QC. Submit to complete destination inward.' : 'Save every LR with Pass status to enable submit.'}</p><button className="btn" disabled={action.isPending || selected.status !== 'READY_FOR_INWARD'} onClick={() => action.mutate({ type: 'inward', tally: selected })}>{busyLabel(action.isPending, 'Submit QC')}</button></div></>}
      </>}
      </div>
    </Modal>}
  </>;
}

function LrReceiptRow({ shipment, item, entry, verified, onChange, onVerify }) {
  const received = entry.receivedPackages ?? (item.receivedPackages || item.expectedPackages);
  const short = Math.max(0, item.expectedPackages - Number(received));
  const extra = Math.max(0, Number(received) - item.expectedPackages);
  return <article className={verified ? 'is-verified' : ''}>
    <span className="last-mile-lr-meta"><b>{lrLabel(shipment)}</b><small>Expected {item.expectedPackages} · Short {short} · Extra {extra}</small></span>
    <div className="tms-epod-fields">
      <label>Received boxes<input aria-label={`Received boxes for ${lrLabel(shipment)}`} type="number" min="0" max="10000" value={received} onChange={(event) => onChange({ receivedPackages: event.target.value })} /></label>
      <label>Damaged boxes<input aria-label={`Damaged boxes for ${lrLabel(shipment)}`} type="number" min="0" max={received} placeholder="0" value={entry.damagedPackages ?? ''} onChange={(event) => onChange({ damagedPackages: event.target.value })} /></label>
      <label className="last-mile-remark">LR remark *<input aria-label={`Remark for ${lrLabel(shipment)}`} placeholder="Add verification remark" value={entry.receiptRemarks ?? ''} onChange={(event) => onChange({ receiptRemarks: event.target.value })} /></label>
      <label className="last-mile-verified"><input type="checkbox" checked={verified} disabled={!entry.receiptRemarks?.trim()} onChange={(event) => onVerify(event.target.checked)} /> Verified</label>
    </div>
  </article>;
}

function QcRow({ item, pending, onSave }) {
  const [status, setStatus] = useState(item.qcStatus === 'PASSED' ? 'PASSED' : 'HOLD');
  return <article><div><ClipboardCheck size={20} /><span><b>{lrLabel(item.shipmentId)}</b><small>Received {item.receivedPackages}/{item.expectedPackages}; damaged {item.damagedPackages || 0}</small></span></div>
    <form className="tms-epod-fields" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); onSave({ qcStatus: status, storageLocation: form.get('storageLocation'), depsCode: form.get('depsCode') || undefined, depsRemarks: form.get('depsRemarks') || undefined }); }}>
      <select value={status} onChange={(event) => setStatus(event.target.value)}><option value="PASSED">Pass</option><option value="HOLD">Hold</option></select>
      <input name="storageLocation" defaultValue={item.storageLocation} placeholder="Bay / rack" required /><input name="depsCode" defaultValue={item.depsCode} placeholder="DEPS code" /><input name="depsRemarks" defaultValue={item.depsRemarks} placeholder="QC / DEPS remarks" />
      <button className="btn secondary" disabled={pending}>Save QC</button>
    </form></article>;
}

function DrsPreparation({ active = false }) {
  const { user } = useAuth(); const base = `/${user.role.toLowerCase()}`; const cache = useQueryClient(); const [open, setOpen] = useState(false); const [manifestId, setManifestId] = useState('');
  const canApprove = ['ADMIN', 'MANAGER'].includes(user.role);
  const manifests = useQuery({ queryKey: ['last-mile-drs-manifests'], queryFn: () => lastMileApi.drsManifests({ limit: 100 }), enabled: !active && open });
  const drs = useQuery({ queryKey: ['last-mile-drs', active], queryFn: () => lastMileApi.drs.list({ limit: 100 }) });
  const users = useQuery({ queryKey: ['delivery-agent-options'], queryFn: () => usersApi.list({ limit: 100, status: 'ACTIVE' }) });
  const refresh = () => { cache.invalidateQueries({ queryKey: ['last-mile-drs'] }); cache.invalidateQueries({ queryKey: ['last-mile-drs-inventory'] }); cache.invalidateQueries({ queryKey: ['last-mile-drs-manifests'] }); };
  const action = useMutation({
    mutationFn: ({ type, id, body }) => type === 'create' ? lastMileApi.drs.create(body) : type === 'finalize' ? lastMileApi.finalizeDrs(id) : lastMileApi.dispatchDrs(id),
    onSuccess: (_data, variables) => { toast.success(variables.type === 'create' ? 'DRS draft created' : variables.type === 'finalize' ? 'DRS ready for dispatch' : 'DRS dispatched'); setOpen(false); setManifestId(''); refresh(); },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const drsRows = rows(drs).filter((row) => active ? ['DISPATCHED', 'CLOSURE_PENDING'].includes(row.workflowStatus) : ['DRAFT', 'READY_FOR_DISPATCH'].includes(row.workflowStatus));
  const selectedManifest = rows(manifests).find((manifest) => idOf(manifest) === manifestId);
  const selectedShipmentIds = selectedManifest?.shipmentIds?.map(idOf) || [];
  const sourceTrip = selectedManifest?.tripId;
  const sourceVehicle = sourceTrip?.vehicleNumber || selectedManifest?.vehicleNumber || '';
  const sourceDriver = sourceTrip?.driverName || selectedManifest?.deliveryAgent || '';
  const sourceDriverMobile = sourceTrip?.driverMobile || '';
  const sourceRoute = selectedManifest?.routeId?.name || selectedManifest?.destination || '';
  const sourceVendor = selectedManifest?.vendorId || sourceTrip?.vendorId;
  const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const save = (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); action.mutate({ type: 'create', body: { manifestId, shipmentIds: selectedShipmentIds, vehicleNumber: form.get('vehicleNumber'), driverName: form.get('driverName'), driverMobile: form.get('driverMobile') || undefined, deliveryAgentId: form.get('deliveryAgentId') || undefined, deliveryDate: form.get('deliveryDate'), route: form.get('route'), partB: [], remarks: form.get('remarks') || undefined } }); };
  return <><PageHeader title={active ? 'Delivery Attempts' : 'DRS Preparation'} description={active ? 'Record delivery outcomes, upload POD and return failed LRs for reattempt.' : 'Assign inwarded LRs once, finalize the sheet and dispatch delivery.'}>{!active && <button className="btn" onClick={() => setOpen(true)}><Truck size={17} /> Create DRS</button>}</PageHeader>
    <section className="panel">{drs.isPending ? <Loadingcrleleton /> : drs.isError ? <ErrorState error={errorMessage(drs.error)} retry={drs.refetch} /> : <DataTable rows={drsRows} empty={active ? 'No active delivery runs' : 'No DRS drafts'} columns={[
      { key: 'number', label: 'DRS', render: (row) => row.drsNumber }, { key: 'manifest', label: 'Manifest', render: (row) => row.manifestId?.manifestNumber || '—' }, { key: 'vendor', label: 'Vendor', render: (row) => row.vendorId?.vendorCode || '—' }, { key: 'vehicle', label: 'Vehicle / Driver', render: (row) => `${row.vehicleNumber} / ${row.driverName}` }, { key: 'route', label: 'Route' }, { key: 'lrs', label: 'LRs', render: (row) => row.shipmentIds?.length || 0 }, { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.workflowStatus} /> },
      { key: 'action', label: 'Actions', render: (row) => <div className="actions">{!active && canApprove && row.workflowStatus === 'DRAFT' && <button className="text-btn" onClick={() => action.mutate({ type: 'finalize', id: idOf(row) })}>Finalize</button>}{!active && canApprove && row.workflowStatus === 'READY_FOR_DISPATCH' && <button className="text-btn" onClick={() => action.mutate({ type: 'dispatch', id: idOf(row) })}>Dispatch</button>}<Link className="btn secondary" to={`${base}/drs/${idOf(row)}`}>Open</Link></div> },
    ]} />}</section>
    {open && <Modal title="Create Delivery Run Sheet" onClose={() => { setOpen(false); setManifestId(''); }}><form className="drs-manifest-create" onSubmit={save}>
      <div className="drs-manifest-picker"><label>Delivery Manifest *<select value={manifestId} onChange={(event) => setManifestId(event.target.value)} required><option value="">{manifests.isPending ? 'Loading eligible manifests…' : 'Select manifest'}</option>{rows(manifests).map((manifest) => <option key={idOf(manifest)} value={idOf(manifest)}>{manifest.manifestNumber} · {manifest.destination} · {manifest.shipmentIds?.length || 0} LRs</option>)}</select></label>{manifests.isError && <ErrorState error={errorMessage(manifests.error)} retry={manifests.refetch} />}{manifests.isSuccess && !rows(manifests).length && <p>No eligible manifest found. Complete Trip Closure, QC and Destination Inward first.</p>}</div>
      {selectedManifest && <div key={manifestId} className="drs-manifest-content">
        <div className="drs-manifest-preview"><DeliveryManifestSheet record={{ ...selectedManifest, vehicleNumber: sourceVehicle, deliveryAgent: sourceDriver }} kind="manifest" /></div>
        <div className="form-grid drs-manifest-fields"><label>Vendor from PRS<input aria-label="DRS vendor from PRS" value={sourceVendor ? `${sourceVendor.vendorCode} · ${sourceVendor.name}` : 'Not available in source PRS'} readOnly /></label><label>Vehicle Number<input name="vehicleNumber" required defaultValue={sourceVehicle} /></label><label>Driver Name<input name="driverName" required defaultValue={sourceDriver} /></label><label>Driver Mobile<input name="driverMobile" defaultValue={sourceDriverMobile} /></label><label>Delivery Agent<select name="deliveryAgentId"><option value="">Vehicle / external driver</option>{rows(users).map((row) => <option key={idOf(row)} value={idOf(row)}>{row.name} - {row.employeeCode || row.role}</option>)}</select><small>Assign any active employee, or keep the manifest driver.</small></label><label>Delivery Date<input name="deliveryDate" type="date" required defaultValue={today} /></label><DeliveryRouteField initialValue={sourceRoute} /><label className="full-span">Remarks<textarea name="remarks" /></label></div>
      </div>}
      <div className="modal-footer"><button type="button" className="btn secondary" onClick={() => { setOpen(false); setManifestId(''); }}>Cancel</button><button className="btn" disabled={!selectedShipmentIds.length || !sourceVendor || action.isPending}>{busyLabel(action.isPending, 'Create DRS')}</button></div>
    </form></Modal>}
  </>;
}

export default function LastMilePage() {
  const path = useLocation().pathname.split('/').at(-1);
  if (path === 'last-mile-arrivals') return <Arrivals />;
  if (path === 'unloading-tallies') return <ReadyForClosure />;
  if (path === 'qc-deps') return <Navigate to="../unloading-tallies" replace />;
  if (path === 'last-mile-inward') return <Tallies mode="inward" />;
  return <DrsPreparation active={path === 'active-deliveries'} />;
}
