import { useState } from 'react';
import UnloadingTallyDocument from '../components/tms/UnloadingTallyDocument';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { ClipboardCheck, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { errorMessage } from '../api/client';
import { lastMileApi, middleMileApi, vendorOptionsApi, branchOptionsApi } from '../api/services';
import { useAuth } from '../features/auth/AuthContext';
import { idOf } from '../lib/workflow';
import { DataTable, ErrorState, Loadingcrleleton, Modal, PageHeader, StatusBadge } from '../components/common/UI';

const lrLabel = (shipment) => shipment?.lrNumber || idOf(shipment);
const rows = (query) => query.data?.data || [];
const busyLabel = (pending, text) => pending ? 'Saving…' : text;

function Arrivals() {
  const cache = useQueryClient();
  const [document, setDocument] = useState(null);
  const query = useQuery({ queryKey: ['last-mile-pending-arrivals'], queryFn: async () => {
    const results = await Promise.all(['DISPATCHED', 'ARRIVED', 'CLOSED'].map((status) => middleMileApi.trips.list({ status, limit: 100 })));
    return { data: [...new Map(results.flatMap((result) => result.data || []).map((trip) => [idOf(trip), trip])).values()] };
  } });
  const arrive = useMutation({
    mutationFn: (tripId) => middleMileApi.arriveTrip(tripId),
    onSuccess: () => { toast.success('Trip marked arrived'); cache.invalidateQueries({ queryKey: ['last-mile-pending-arrivals'] }); cache.invalidateQueries({ queryKey: ['last-mile-arrivals'] }); cache.invalidateQueries({ queryKey: ['middle-mile-trips'] }); },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const columns = [
      { key: 'trip', label: 'Trip', render: (row) => row.tripNumber },
      { key: 'vehicle', label: 'Vehicle / Driver', render: (row) => `${row.vehicleNumber} / ${row.driverName}` },
      { key: 'from', label: 'Movement', render: (row) => `${row.fromHubId?.name || row.origin} → ${row.toHubId?.name || row.destination}` },
      { key: 'lrs', label: 'LRs / Boxes', render: (row) => `${row.shipmentIds?.length || 0} / ${row.totalPackages || 0}` },
      { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
      { key: 'action', label: 'Action', render: (row) => <div className="actions">{row.status === 'DISPATCHED' && <button className="btn secondary" disabled={arrive.isPending} onClick={() => arrive.mutate(idOf(row))}>Mark Arrived</button>}<button className="btn secondary" onClick={() => setDocument({ tripId: idOf(row) })}>View</button><button className="btn secondary" onClick={() => setDocument({ tripId: idOf(row), autoPrint: true })}>Print Unloading Tally</button></div> },
    ];
  return <><PageHeader title="Trip Arrival" description="Mark dispatched Middle Mile trips as arrived at the destination hub." />
    {[{ status: 'DISPATCHED', title: 'Pending Arrivals', empty: 'No dispatched trips pending arrival' }, { status: 'ARRIVED', title: 'Arrived Trips', empty: 'No arrived trips' }].map(({ status, title, empty }) => <section className="panel" key={status} aria-label={title}>
      <div className="panel-heading"><h2>{title}</h2></div>
      {query.isPending ? <Loadingcrleleton /> : query.isError ? <ErrorState error={errorMessage(query.error)} retry={query.refetch} /> : <DataTable rows={rows(query).filter((row) => status === 'ARRIVED' ? ['ARRIVED', 'CLOSED'].includes(row.status) : row.status === status)} empty={empty} columns={columns} />}
    </section>)}
    {document && <UnloadingTallyDocument {...document} onClose={() => setDocument(null)} />}
  </>;

}

function ReadyForClosure() {
  const cache = useQueryClient();
  const [document, setDocument] = useState(null);
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
      { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
      { key: 'action', label: 'Action', render: (row) => <div className="actions"><button className="btn secondary" disabled={create.isPending} onClick={() => create.mutate(idOf(row))}>Process Trip</button><button className="btn secondary" onClick={() => setDocument({ tripId: idOf(row) })}>View</button><button className="btn secondary" onClick={() => setDocument({ tripId: idOf(row), autoPrint: true })}>Print Unloading Tally</button></div> },
    ]} />}</section><Tallies />{document && <UnloadingTallyDocument {...document} onClose={() => setDocument(null)} />}</>;
}

function Tallies() {
  const cache = useQueryClient(); const [selectedRecord, setSelected] = useState(null);
  const [exceptions, setExceptions] = useState({}); const [checked, setChecked] = useState([]);
  const query = useQuery({ queryKey: ['unloading-tallies', 'closure'], queryFn: () => lastMileApi.tallies.list({ limit: 100 }) });
  const detail = useQuery({ queryKey: ['unloading-tally', idOf(selectedRecord)], queryFn: () => lastMileApi.tallies.detail(idOf(selectedRecord)), enabled: Boolean(selectedRecord) });
  const selected = detail.data?.data || rows(query).find((row) => idOf(row) === idOf(selectedRecord)) || selectedRecord;
  const refresh = () => { cache.invalidateQueries({ queryKey: ['last-mile-pending-arrivals'] }); cache.invalidateQueries({ queryKey: ['unloading-tallies'] }); cache.invalidateQueries({ queryKey: ['unloading-tally'] }); cache.invalidateQueries({ queryKey: ['last-mile-arrivals'] }); cache.invalidateQueries({ queryKey: ['last-mile-drs-inventory'] }); cache.invalidateQueries({ queryKey: ['last-mile-drs-manifests'] }); };
  const action = useMutation({
    mutationFn: ({ type, tally, payload }) => type === 'complete' ? lastMileApi.completeTally(idOf(tally), payload) : type === 'qc' ? lastMileApi.updateQc(idOf(tally), payload.shipmentId, payload.body) : lastMileApi.inward(idOf(tally), payload),
    onSuccess: (_data, variables) => { toast.success({ complete: 'Trip closed; LRs available for DRS', qc: 'QC / DEPS saved', inward: 'QC submitted; LRs ready for DRS creation' }[variables.type]); if (['complete', 'inward'].includes(variables.type)) setSelected(null); refresh(); },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const statusAllowed = (row) => ['UNLOADING', 'QC_PENDING', 'READY_FOR_INWARD'].includes(row.status);
  const visible = rows(query).filter(statusAllowed);
  const title = 'Trips in Process / QC / DEPS';
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
  return <>
    <section className="panel"><div className="panel-heading"><h2>{title}</h2></div>{query.isPending ? <Loadingcrleleton /> : query.isError ? <ErrorState error={errorMessage(query.error)} retry={query.refetch} /> : <DataTable rows={visible} empty={`No ${title.toLowerCase()} records`} columns={[
      { key: 'number', label: 'Tally', render: (row) => row.tallyNumber }, { key: 'trip', label: 'Trip', render: (row) => row.tripId?.tripNumber || '—' },
      { key: 'count', label: 'LRs / Boxes', render: (row) => `${row.totalLrs} / ${row.totalPackages}` },
      { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
      { key: 'action', label: 'Action', render: (row) => <button className="btn secondary" onClick={() => { setSelected(row); setExceptions({}); setChecked([]); }}>View</button> },
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
        <div className="last-mile-modal-footer"><p>{selected.status === 'READY_FOR_INWARD' ? 'All LRs passed QC. Submit to make them available for DRS creation.' : 'Save every LR with Pass status to enable submit.'}</p><button className="btn" disabled={action.isPending || selected.status !== 'READY_FOR_INWARD'} onClick={() => action.mutate({ type: 'inward', tally: selected })}>{busyLabel(action.isPending, 'Submit QC')}</button></div></>}
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

const vendorTypes = [{ value: 'MV', label: 'Market Vehicle (MV)' }, { value: 'VV', label: 'Vendor Vehicle (VV)' }];

function DrsPreparation({ active = false }) {
  const { user } = useAuth();
  const base = `/${user.role.toLowerCase()}`;
  const cache = useQueryClient();
  const [open, setOpen] = useState(false);
  const [branchId, setBranchId] = useState(idOf(user.branchId) || '');
  const [vendorType, setVendorType] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const branches = useQuery({ queryKey: ['drs-branch-options'], queryFn: () => branchOptionsApi.list(), enabled: open });
  const vendors = useQuery({ queryKey: ['drs-vendor-options'], queryFn: () => vendorOptionsApi.list(), enabled: open });
  const inventory = useQuery({ queryKey: ['last-mile-drs-inventory', branchId, search], queryFn: () => lastMileApi.inventory({ branchId, search: search || undefined, limit: 100 }), enabled: open && Boolean(branchId) });
  const drs = useQuery({ queryKey: ['last-mile-drs', active], queryFn: () => lastMileApi.drs.list({ limit: 100 }) });
  const reset = () => { setOpen(false); setVendorType(''); setVendorId(''); setVehicleNumber(''); setSelected([]); setSearch(''); setPickerOpen(false); };
  const action = useMutation({
    mutationFn: (body) => lastMileApi.drs.create(body),
    onSuccess: () => { toast.success('DRS created. Upload POD in DRS Closure.'); reset(); cache.invalidateQueries({ queryKey: ['last-mile-drs'] }); cache.invalidateQueries({ queryKey: ['drs'] }); cache.invalidateQueries({ queryKey: ['last-mile-drs-inventory'] }); },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const selectedVendor = rows(vendors).find((row) => idOf(row) === vendorId);
  const mappedVehicles = (vendorType === 'MV' ? (selectedVendor?.marketVehicles?.length ? selectedVendor.marketVehicles : selectedVendor?.vendorType === 'MARKET' ? selectedVendor.vehicles : []) : selectedVendor?.vehicles) || [];
  const availableVehicles = mappedVehicles.filter((vehicle) => vehicle.status !== 'INACTIVE');
  const selectedVehicle = availableVehicles.find((vehicle) => vehicle.vehicleNumber === vehicleNumber) || availableVehicles[0];
  const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const save = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    action.mutate({ branchId, vehicleSource: vendorType, vendorId, shipmentIds: selected.map(idOf), vehicleNumber: form.get('vehicleNumber'), driverName: form.get('driverName'), driverMobile: form.get('driverMobile') || undefined, deliveryDate: form.get('deliveryDate'), partB: [], remarks: form.get('remarks') || undefined });
  };
  const branchLocked = user.role === 'EMPLOYEE' && Array.isArray(user.operationStages);
  return <><PageHeader title={active ? 'Delivery Attempts' : 'DRS Preparation'} description="Select a vendor and undelivered branch LRs to create a delivery run. Complete POD upload separately in DRS Closure.">
    {!active && <button className="btn" onClick={() => setOpen(true)}><Truck size={17} /> Create DRS</button>}
    <Link className="btn secondary" to={`${base}/drs-closure`}>DRS Closure</Link>
  </PageHeader>
    <section className="panel">{drs.isPending ? <Loadingcrleleton /> : drs.isError ? <ErrorState error={errorMessage(drs.error)} retry={drs.refetch} /> : <DataTable rows={rows(drs).filter((row) => row.status === 'OPEN')} empty="No open DRS" columns={[
      { key: 'number', label: 'DRS', render: (row) => row.drsNumber },
      { key: 'branch', label: 'Branch', render: (row) => row.branchId?.name || '-' },
      { key: 'vendor', label: 'Vendor', render: (row) => row.vendorId?.name || row.vendorId?.vendorCode || '-' },
      { key: 'vehicle', label: 'Vehicle / Driver', render: (row) => `${row.vehicleNumber} / ${row.driverName}` },
      { key: 'lrs', label: 'LRs', render: (row) => row.shipmentIds?.length || 0 },
      { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
      { key: 'action', label: 'Actions', render: (row) => <div className="actions"><Link className="btn secondary" to={`${base}/drs/${idOf(row)}`}>View</Link><Link className="btn secondary" to={`${base}/drs/${idOf(row)}`} state={{ from: 'closure' }}>POD Closure Checklist</Link></div> },
    ]} />}</section>
    {open && <Modal title="Create Delivery Run Sheet" onClose={reset}><form className="drs-manifest-create" onSubmit={save}>
      <div className="form-grid drs-manifest-fields">
        <label>Branch *<select aria-label="Branch" value={branchId} required disabled={branchLocked} onChange={(event) => { setBranchId(event.target.value); setSelected([]); setSearch(''); }}><option value="">Select branch</option>{rows(branches).map((row) => <option key={idOf(row)} value={idOf(row)}>{row.name}</option>)}</select></label>
        <label>Vendor type *<select aria-label="Vendor type" value={vendorType} required onChange={(event) => { setVendorType(event.target.value); setVendorId(''); setVehicleNumber(''); }}><option value="">Select vendor type</option>{vendorTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
        <label>Vendor *<select aria-label="Vendor" value={vendorId} required disabled={!vendorType} onChange={(event) => { setVendorId(event.target.value); setVehicleNumber(''); }}><option value="">Select vendor</option>{rows(vendors).filter((row) => vendorType === 'MV' ? row.vendorType === 'MARKET' || row.hasMarketVehicles : row.vendorType !== 'MARKET').map((row) => <option key={idOf(row)} value={idOf(row)}>{row.vendorCode} - {row.name}</option>)}</select></label>
        <div className="full-span drs-lr-picker">
          <label htmlFor="drs-lr-search">Undelivered LRs *</label>
          <input id="drs-lr-search" role="combobox" aria-expanded={pickerOpen} aria-controls="drs-lr-options" aria-autocomplete="list" disabled={!branchId || !vendorId} placeholder="Search LR number, receiver or mobile" value={search} onFocus={() => setPickerOpen(true)} onChange={(event) => { setSearch(event.target.value); setPickerOpen(true); }} />
          {pickerOpen && branchId && vendorId && <div className="drs-lr-options" id="drs-lr-options" role="listbox" aria-label="Available LRs" aria-multiselectable="true">
            {inventory.isPending ? <p>Loading LRs...</p> : inventory.isError ? <ErrorState error={errorMessage(inventory.error)} retry={inventory.refetch} /> : rows(inventory).length ? rows(inventory).map((lr) => {
              const checked = selected.some((row) => idOf(row) === idOf(lr));
              return <button type="button" role="option" aria-selected={checked} key={idOf(lr)} onClick={() => setSelected((current) => checked ? current.filter((row) => idOf(row) !== idOf(lr)) : [...current, lr])}>{checked ? '[Selected] ' : ''}{lr.lrNumber} - {lr.receiverName} - {lr.packageCount} boxes</button>;
            }) : <p>No undelivered LRs available at this branch.</p>}
            <button type="button" className="text-btn" onClick={() => setPickerOpen(false)}>Done selecting</button>
          </div>}
          <div className="drs-selected-lrs">{selected.map((lr) => <button type="button" className="btn secondary" key={idOf(lr)} onClick={() => setSelected((current) => current.filter((row) => idOf(row) !== idOf(lr)))} aria-label={`Remove ${lr.lrNumber}`}>{lr.lrNumber} x</button>)}</div>
          <small>{selected.length} LRs selected. Only received, unassigned LRs from this branch are shown.</small>
        </div>
        <label>Vehicle Number<select name="vehicleNumber" required value={selectedVehicle?.vehicleNumber || ''} onChange={(event) => setVehicleNumber(event.target.value)} disabled={!vendorId}><option value="">Select mapped vehicle</option>{availableVehicles.map((vehicle) => <option key={vehicle.vehicleNumber} value={vehicle.vehicleNumber}>{vehicle.vehicleNumber}{vehicle.vehicleType ? ` - ${vehicle.vehicleType}` : ''}</option>)}</select>{vendorId && !availableVehicles.length && <small>No active vehicles mapped to this vendor. Update the vendor vehicle mapping first.</small>}</label>
        <label>Driver Name<input name="driverName" required readOnly value={selectedVehicle?.driverName || ''} placeholder="From selected vehicle" />{selectedVehicle && !selectedVehicle.driverName && <small>Add a driver to this vehicle in Vendor Master.</small>}</label>
        <label>Driver Mobile<input name="driverMobile" readOnly value={selectedVehicle?.driverMobile || ''} placeholder="From selected vehicle" /></label>
        <label>Delivery Date<input name="deliveryDate" type="date" required defaultValue={today} /></label>
        <label className="full-span">Remarks<textarea name="remarks" /></label>
      </div>
      {branches.isError && <ErrorState error={errorMessage(branches.error)} retry={branches.refetch} />}
      {vendors.isError && <ErrorState error={errorMessage(vendors.error)} retry={vendors.refetch} />}
      <div className="modal-footer"><button type="button" className="btn secondary" onClick={reset}>Cancel</button><button className="btn" disabled={!branchId || !vendorId || !selected.length || !selectedVehicle?.driverName || action.isPending}>{busyLabel(action.isPending, 'Create DRS')}</button></div>
    </form></Modal>}
  </>;
}

export default function LastMilePage() {
  const path = useLocation().pathname.split('/').at(-1);
  if (path === 'last-mile-arrivals') return <Arrivals />;
  if (path === 'unloading-tallies') return <ReadyForClosure />;
  if (path === 'qc-deps') return <Navigate to="../unloading-tallies" replace />;
  if (path === 'last-mile-inward') return <Navigate to="../unloading-tallies" replace />;
  return <DrsPreparation active={path === 'active-deliveries'} />;
}
