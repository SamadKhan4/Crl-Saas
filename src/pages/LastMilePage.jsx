import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation } from 'react-router-dom';
import { ClipboardCheck, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { errorMessage } from '../api/client';
import { lastMileApi, usersApi } from '../api/services';
import { useAuth } from '../features/auth/AuthContext';
import { idOf } from '../lib/workflow';
import { DataTable, ErrorState, Loadingcrleleton, Modal, PageHeader, StatusBadge } from '../components/common/UI';

const lrLabel = (shipment) => shipment?.lrNumber || idOf(shipment);
const rows = (query) => query.data?.data || [];
const busyLabel = (pending, text) => pending ? 'Saving…' : text;

function Arrivals() {
  const cache = useQueryClient();
  const query = useQuery({ queryKey: ['last-mile-arrivals'], queryFn: () => lastMileApi.arrivals({ limit: 100 }) });
  const create = useMutation({
    mutationFn: (tripId) => lastMileApi.tallies.create({ tripId }),
    onSuccess: () => { toast.success('Unloading tally created'); cache.invalidateQueries({ queryKey: ['last-mile-arrivals'] }); cache.invalidateQueries({ queryKey: ['unloading-tallies'] }); },
    onError: (error) => toast.error(errorMessage(error)),
  });
  return <><PageHeader title="Last Mile Arrival" description="Receive final-destination Middle Mile trips and start package-wise unloading." />
    <section className="panel">{query.isPending ? <Loadingcrleleton /> : query.isError ? <ErrorState error={errorMessage(query.error)} retry={query.refetch} /> : <DataTable rows={rows(query)} empty="No arrived Last Mile trips" columns={[
      { key: 'trip', label: 'Trip', render: (row) => row.tripNumber },
      { key: 'vehicle', label: 'Vehicle / Driver', render: (row) => `${row.vehicleNumber} / ${row.driverName}` },
      { key: 'from', label: 'Movement', render: (row) => `${row.fromHubId?.name || row.origin} → ${row.toHubId?.name || row.destination}` },
      { key: 'lrs', label: 'LRs / Packages', render: (row) => `${row.shipmentIds?.length || 0} / ${row.totalPackages || 0}` },
      { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.workflowStatus} /> },
      { key: 'action', label: 'Action', render: (row) => <button className="btn secondary" disabled={create.isPending} onClick={() => create.mutate(idOf(row))}>Start Unloading</button> },
    ]} />}</section></>;
}

function Tallies({ mode = 'unloading' }) {
  const cache = useQueryClient(); const [selected, setSelected] = useState(null); const [barcode, setBarcode] = useState('');
  const [exceptions, setExceptions] = useState({});
  const query = useQuery({ queryKey: ['unloading-tallies', mode], queryFn: () => lastMileApi.tallies.list({ limit: 100 }) });
  const refresh = () => { cache.invalidateQueries({ queryKey: ['unloading-tallies'] }); cache.invalidateQueries({ queryKey: ['last-mile-arrivals'] }); cache.invalidateQueries({ queryKey: ['last-mile-drs-inventory'] }); };
  const action = useMutation({
    mutationFn: ({ type, tally, payload }) => type === 'scan' ? lastMileApi.scanTally(idOf(tally), payload) : type === 'complete' ? lastMileApi.completeTally(idOf(tally), payload) : type === 'qc' ? lastMileApi.updateQc(idOf(tally), payload.shipmentId, payload.body) : lastMileApi.inward(idOf(tally), payload),
    onSuccess: (_data, variables) => { toast.success({ scan: 'Package unloaded', complete: 'Unloading completed; QC is pending', qc: 'QC / DEPS saved', inward: 'Destination inward completed' }[variables.type]); setBarcode(''); refresh(); },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const statusAllowed = (row) => mode === 'unloading' ? row.status === 'UNLOADING' : mode === 'qc' ? ['QC_PENDING', 'READY_FOR_INWARD'].includes(row.status) : row.status === 'READY_FOR_INWARD';
  const visible = rows(query).filter(statusAllowed);
  const title = mode === 'unloading' ? 'Unloading Tally' : mode === 'qc' ? 'QC / DEPS' : 'Destination Inward';
  return <><PageHeader title={title} description={mode === 'unloading' ? 'Scan every package; shortages, damage and excess require a DEPS code.' : mode === 'qc' ? 'Pass or hold each LR and record storage location plus configurable DEPS details.' : 'Only QC-passed LRs can enter delivery inventory.'} />
    <section className="panel">{query.isPending ? <Loadingcrleleton /> : query.isError ? <ErrorState error={errorMessage(query.error)} retry={query.refetch} /> : <DataTable rows={visible} empty={`No ${title.toLowerCase()} records`} columns={[
      { key: 'number', label: 'Tally', render: (row) => row.tallyNumber }, { key: 'trip', label: 'Trip', render: (row) => row.tripId?.tripNumber || '—' },
      { key: 'count', label: 'LRs / Scanned', render: (row) => `${row.totalLrs} / ${row.scannedPackages}-${row.totalPackages}` },
      { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
      { key: 'action', label: 'Action', render: (row) => mode === 'inward' ? <button className="btn" disabled={action.isPending} onClick={() => action.mutate({ type: 'inward', tally: row })}>Confirm Inward</button> : <button className="btn secondary" onClick={() => setSelected(row)}>{mode === 'qc' ? 'Open QC' : 'Open Tally'}</button> },
    ]} />}</section>
    {selected && <Modal title={`${selected.tallyNumber} - ${mode === 'qc' ? 'QC / DEPS' : 'Unloading'}`} onClose={() => setSelected(null)}>
      {mode === 'unloading' ? <>
        <form onSubmit={(event) => { event.preventDefault(); action.mutate({ type: 'scan', tally: selected, payload: barcode }); }}><div className="form-grid"><label className="full-span">Package Barcode<input autoFocus value={barcode} onChange={(event) => setBarcode(event.target.value.toUpperCase())} required /></label></div><div className="modal-footer"><button className="btn" disabled={action.isPending}>{busyLabel(action.isPending, 'Scan Package')}</button></div></form>
        <div className="tms-pod-list">{selected.items?.map((item) => { const shipmentId = idOf(item.shipmentId); const shortage = Math.max(0, item.expectedPackages - item.receivedPackages); return <article key={shipmentId}><span><b>{lrLabel(item.shipmentId)}</b><small>{item.receivedPackages}/{item.expectedPackages} received{shortage ? `; short ${shortage}` : ''}</small></span><div className="tms-epod-fields"><input type="number" min="0" placeholder="Damaged" onChange={(event) => setExceptions((current) => ({ ...current, [shipmentId]: { ...current[shipmentId], damagedPackages: event.target.value } }))} /><input type="number" min="0" placeholder="Excess" onChange={(event) => setExceptions((current) => ({ ...current, [shipmentId]: { ...current[shipmentId], excessPackages: event.target.value } }))} /><input placeholder="DEPS code for exception" onChange={(event) => setExceptions((current) => ({ ...current, [shipmentId]: { ...current[shipmentId], depsCode: event.target.value } }))} /><input placeholder="Exception remarks" onChange={(event) => setExceptions((current) => ({ ...current, [shipmentId]: { ...current[shipmentId], depsRemarks: event.target.value } }))} /></div></article>; })}</div>
        <button className="btn" disabled={action.isPending} onClick={() => action.mutate({ type: 'complete', tally: selected, payload: selected.items.map((item) => ({ shipmentId: idOf(item.shipmentId), excessPackages: exceptions[idOf(item.shipmentId)]?.excessPackages || 0, damagedPackages: exceptions[idOf(item.shipmentId)]?.damagedPackages || 0, depsCode: exceptions[idOf(item.shipmentId)]?.depsCode || undefined, depsRemarks: exceptions[idOf(item.shipmentId)]?.depsRemarks || undefined })) })}>Complete Unloading</button>
      </> : <div className="tms-pod-list">{selected.items?.map((item) => <QcRow key={idOf(item.shipmentId)} item={item} pending={action.isPending} onSave={(body) => action.mutate({ type: 'qc', tally: selected, payload: { shipmentId: idOf(item.shipmentId), body } })} />)}</div>}
    </Modal>}
  </>;
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
  const { user } = useAuth(); const base = `/${user.role.toLowerCase()}`; const cache = useQueryClient(); const [open, setOpen] = useState(false); const [selected, setSelected] = useState([]);
  const canApprove = ['ADMIN', 'MANAGER'].includes(user.role);
  const inventory = useQuery({ queryKey: ['last-mile-drs-inventory'], queryFn: () => lastMileApi.inventory({ limit: 100 }), enabled: !active });
  const drs = useQuery({ queryKey: ['last-mile-drs', active], queryFn: () => lastMileApi.drs.list({ limit: 100 }) });
  const users = useQuery({ queryKey: ['delivery-agent-options'], queryFn: () => usersApi.list({ limit: 100, status: 'ACTIVE' }) });
  const refresh = () => { cache.invalidateQueries({ queryKey: ['last-mile-drs'] }); cache.invalidateQueries({ queryKey: ['last-mile-drs-inventory'] }); };
  const action = useMutation({
    mutationFn: ({ type, id, body }) => type === 'create' ? lastMileApi.drs.create(body) : type === 'finalize' ? lastMileApi.finalizeDrs(id) : lastMileApi.dispatchDrs(id),
    onSuccess: (_data, variables) => { toast.success(variables.type === 'create' ? 'DRS draft created' : variables.type === 'finalize' ? 'DRS ready for dispatch' : 'DRS dispatched'); setOpen(false); setSelected([]); refresh(); },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const drsRows = rows(drs).filter((row) => active ? ['DISPATCHED', 'CLOSURE_PENDING'].includes(row.workflowStatus) : ['DRAFT', 'READY_FOR_DISPATCH'].includes(row.workflowStatus));
  const save = (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); action.mutate({ type: 'create', body: { shipmentIds: selected, vehicleNumber: form.get('vehicleNumber'), driverName: form.get('driverName'), driverMobile: form.get('driverMobile') || undefined, deliveryAgentId: form.get('deliveryAgentId') || undefined, deliveryDate: form.get('deliveryDate'), route: form.get('route'), partB: [], remarks: form.get('remarks') || undefined } }); };
  return <><PageHeader title={active ? 'Delivery Attempts' : 'DRS Preparation'} description={active ? 'Record delivery outcomes, upload POD and return failed LRs for reattempt.' : 'Assign inwarded LRs once, finalize the sheet and dispatch delivery.'}>{!active && <button className="btn" onClick={() => setOpen(true)}><Truck size={17} /> Create DRS</button>}</PageHeader>
    <section className="panel">{drs.isPending ? <Loadingcrleleton /> : drs.isError ? <ErrorState error={errorMessage(drs.error)} retry={drs.refetch} /> : <DataTable rows={drsRows} empty={active ? 'No active delivery runs' : 'No DRS drafts'} columns={[
      { key: 'number', label: 'DRS', render: (row) => row.drsNumber }, { key: 'vehicle', label: 'Vehicle / Driver', render: (row) => `${row.vehicleNumber} / ${row.driverName}` }, { key: 'route', label: 'Route' }, { key: 'lrs', label: 'LRs', render: (row) => row.shipmentIds?.length || 0 }, { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.workflowStatus} /> },
      { key: 'action', label: 'Actions', render: (row) => <div className="actions">{!active && canApprove && row.workflowStatus === 'DRAFT' && <button className="text-btn" onClick={() => action.mutate({ type: 'finalize', id: idOf(row) })}>Finalize</button>}{!active && canApprove && row.workflowStatus === 'READY_FOR_DISPATCH' && <button className="text-btn" onClick={() => action.mutate({ type: 'dispatch', id: idOf(row) })}>Dispatch</button>}<Link className="btn secondary" to={`${base}/drs/${idOf(row)}`}>Open</Link></div> },
    ]} />}</section>
    {open && <Modal title="Create Delivery Run Sheet" onClose={() => setOpen(false)}><form onSubmit={save}><fieldset><legend>Available inwarded LRs</legend>{inventory.isPending ? <Loadingcrleleton /> : rows(inventory).map((row) => <label key={idOf(row)}><input type="checkbox" checked={selected.includes(idOf(row))} onChange={(event) => setSelected((current) => event.target.checked ? [...current, idOf(row)] : current.filter((value) => value !== idOf(row)))} /> {row.lrNumber} - {row.receiverName}</label>)}</fieldset><div className="form-grid"><label>Vehicle Number<input name="vehicleNumber" required /></label><label>Driver Name<input name="driverName" required /></label><label>Driver Mobile<input name="driverMobile" /></label><label>Delivery Agent<select name="deliveryAgentId"><option value="">Vehicle / external driver</option>{rows(users).map((row) => <option key={idOf(row)} value={idOf(row)}>{row.name} - {row.employeeCode || row.role}</option>)}</select></label><label>Delivery Date<input name="deliveryDate" type="date" required /></label><label>Route<input name="route" required /></label><label className="full-span">Remarks<textarea name="remarks" /></label></div><div className="modal-footer"><button type="button" className="btn secondary" onClick={() => setOpen(false)}>Cancel</button><button className="btn" disabled={!selected.length || action.isPending}>{busyLabel(action.isPending, 'Create DRS')}</button></div></form></Modal>}
  </>;
}

export default function LastMilePage() {
  const path = useLocation().pathname.split('/').at(-1);
  if (path === 'last-mile-arrivals') return <Arrivals />;
  if (path === 'unloading-tallies') return <Tallies />;
  if (path === 'qc-deps') return <Tallies mode="qc" />;
  if (path === 'last-mile-inward') return <Tallies mode="inward" />;
  return <DrsPreparation active={path === 'active-deliveries'} />;
}
