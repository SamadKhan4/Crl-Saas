import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardCheck, PackageCheck, RefreshCw, ScanLine, Truck } from 'lucide-react';
import { toast } from 'sonner';
import {
  branchOptionsApi,
  masterOptionsApi,
  middleMileApi,
  vendorOptionsApi,
} from '../api/services';
import { errorMessage } from '../api/client';
import { useAuth } from '../features/auth/AuthContext';
import { date, idOf } from '../lib/workflow';
import {
  DataTable,
  ErrorState,
  Loadingcrleleton,
  Modal,
  PageHeader,
  StatCard,
  StatusBadge,
} from '../components/common/UI';

const rows = (query) => query.data?.data || [];
const busyLabel = (pending, text) => (pending ? 'Saving…' : text);
const optionName = (record) =>
  record.branchCode
    ? `${record.branchCode} - ${record.name}`
    : record.code
      ? `${record.code} - ${record.name}`
      : record.name;

function useMasters() {
  const branches = useQuery({ queryKey: ['branch-options'], queryFn: branchOptionsApi.list });
  const routes = useQuery({ queryKey: ['master-options', 'ROUTE'], queryFn: () => masterOptionsApi.list('ROUTE') });
  return { branches: rows(branches), routes: rows(routes), pending: branches.isPending || routes.isPending };
}

function HubRouteFields({ branches, routes, defaults = {}, includeCurrent = true }) {
  return <>
    {includeCurrent && <label>Current / From Hub<select name="branchId" defaultValue={idOf(defaults.fromHubId) || ''} required><option value="">Select hub</option>{branches.map((branch) => <option key={idOf(branch)} value={idOf(branch)}>{optionName(branch)}</option>)}</select></label>}
    <label>Next / To Hub<select name="nextHubId" defaultValue={idOf(defaults.nextHubId || defaults.toHubId) || ''} required><option value="">Select next hub</option>{branches.map((branch) => <option key={idOf(branch)} value={idOf(branch)}>{optionName(branch)}</option>)}</select></label>
    <label>Route<select name="routeId" defaultValue={idOf(defaults.routeId) || ''}><option value="">No route selected</option>{routes.map((route) => <option key={idOf(route)} value={idOf(route)}>{optionName(route)} ({route.origin} → {route.destination})</option>)}</select></label>
  </>;
}

function InwardWorkspace() {
  const { branches, routes, pending } = useMasters();
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: middleMileApi.hubInward,
    onSuccess: (response) => {
      toast.success(`${response.data.lrNumber} inwarded and ready for sorting`);
      client.invalidateQueries({ queryKey: ['middle-mile-sorting-inventory'] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const save = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    mutation.mutate({
      lrNumber: form.get('lrNumber'), branchId: form.get('branchId'), nextHubId: form.get('nextHubId'),
      routeId: form.get('routeId') || undefined, remarks: form.get('remarks') || undefined,
    });
  };
  return <>
    <PageHeader title="Hub Inward" description="Confirm physical receipt at the origin/current hub before an LR enters Middle Mile." />
    <section className="panel"><div className="panel-heading"><div><h2>Inward First Mile LR</h2><p>The same LR and package records continue into Middle Mile.</p></div></div>
      {pending ? <Loadingcrleleton /> : <form onSubmit={save}><div className="form-grid"><label>LR / Docket Number<input name="lrNumber" required autoFocus placeholder="Scan or enter LR number" /></label><HubRouteFields branches={branches} routes={routes} /><label className="full-span">Remarks<textarea name="remarks" /></label></div><div className="modal-footer"><button className="btn" disabled={mutation.isPending}><ScanLine size={17} /> {busyLabel(mutation.isPending, 'Confirm Hub Inward')}</button></div></form>}
    </section>
  </>;
}

function SortingWorkspace() {
  const { branches, routes } = useMasters();
  const client = useQueryClient();
  const [page, setPage] = useState(1), [search, setSearch] = useState(''), [selected, setSelected] = useState(null);
  const query = useQuery({ queryKey: ['middle-mile-sorting-inventory', page, search], queryFn: () => middleMileApi.sortingInventory({ page, limit: 20, search: search || undefined }) });
  const mutation = useMutation({
    mutationFn: middleMileApi.sort,
    onSuccess: () => { toast.success('LR sorted and released for loading'); setSelected(null); client.invalidateQueries({ queryKey: ['middle-mile-sorting-inventory'] }); client.invalidateQueries({ queryKey: ['sorting-options'] }); },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const hold = useMutation({
    mutationFn: ({ row, action, reason }) => middleMileApi.hold(idOf(row), { action, reason }),
    onSuccess: (_, variables) => { toast.success(variables.action === 'HOLD' ? 'LR placed on hold' : 'LR released'); client.invalidateQueries({ queryKey: ['middle-mile-sorting-inventory'] }); },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const save = (event) => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    mutation.mutate({ shipmentIds: [idOf(selected)], branchId: idOf(selected.currentHubId), nextHubId: form.get('nextHubId'), routeId: form.get('routeId') || undefined, sortZone: form.get('sortZone'), bay: form.get('bay') || undefined, rack: form.get('rack') || undefined, remarks: form.get('remarks') || undefined });
  };
  return <>
    <PageHeader title="Segregation & Sorting" description="Only physically inwarded LRs at the current hub are shown."><div className="actions"><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search LR or customer" /><button className="btn secondary" onClick={() => query.refetch()}><RefreshCw size={16} /> Refresh</button></div></PageHeader>
    <section className="panel">{query.isPending ? <Loadingcrleleton /> : query.isError ? <ErrorState error={errorMessage(query.error)} retry={query.refetch} /> : <DataTable rows={rows(query)} pagination={query.data.pagination} onPage={setPage} empty="No inwarded LRs waiting for sorting" columns={[
      { key: 'lrNumber', label: 'LR' }, { key: 'client', label: 'Client', render: (row) => row.customerId?.name || row.senderName },
      { key: 'lane', label: 'Movement', render: (row) => `${row.currentHubId?.name || '—'} → ${row.nextHubId?.name || '—'}` },
      { key: 'packages', label: 'Packages', render: (row) => row.packageCount }, { key: 'weightKg', label: 'Weight (kg)' },
      { key: 'movementState', label: 'Status', render: (row) => <StatusBadge status={row.movementState} /> },
      { key: 'action', label: 'Actions', render: (row) => <div className="actions">{row.movementState === 'HOLD' ? <button className="text-btn" onClick={() => { const reason = window.prompt('Release remarks'); if (reason?.trim()) hold.mutate({ row, action: 'RELEASE', reason }); }}>Release</button> : <><button className="text-btn" onClick={() => setSelected(row)}>Sort LR</button><button className="text-btn" onClick={() => { const reason = window.prompt('Hold reason'); if (reason?.trim()) hold.mutate({ row, action: 'HOLD', reason }); }}>Hold</button></>}</div> },
    ]} />}</section>
    {selected && <Modal title={`Sort ${selected.lrNumber}`} onClose={() => setSelected(null)}><form onSubmit={save}><div className="form-grid"><HubRouteFields branches={branches} routes={routes} defaults={selected} includeCurrent={false} /><label>Sort Zone<input name="sortZone" required autoFocus /></label><label>Bay<input name="bay" /></label><label>Rack<input name="rack" /></label><label className="full-span">Remarks<textarea name="remarks" /></label></div><div className="modal-footer"><button type="button" className="btn secondary" onClick={() => setSelected(null)}>Cancel</button><button className="btn" disabled={mutation.isPending}>{busyLabel(mutation.isPending, 'Mark Sorted')}</button></div></form></Modal>}
  </>;
}

function TallyWorkspace() {
  const client = useQueryClient(); const [page, setPage] = useState(1), [open, setOpen] = useState(false), [scanRow, setScanRow] = useState(null);
  const query = useQuery({ queryKey: ['loading-tallies', page], queryFn: () => middleMileApi.tallies.list({ page, limit: 20 }) });
  const options = useQuery({ queryKey: ['sorting-options'], queryFn: () => middleMileApi.sortingOptions({ limit: 100 }) });
  const refresh = () => { client.invalidateQueries({ queryKey: ['loading-tallies'] }); client.invalidateQueries({ queryKey: ['sorting-options'] }); };
  const create = useMutation({ mutationFn: middleMileApi.tallies.create, onSuccess: () => { toast.success('Loading tally created'); setOpen(false); refresh(); }, onError: (error) => toast.error(errorMessage(error)) });
  const scan = useMutation({ mutationFn: ({ id, barcode }) => middleMileApi.scanTally(id, barcode), onSuccess: () => { toast.success('Package scanned'); refresh(); }, onError: (error) => toast.error(errorMessage(error)) });
  const complete = useMutation({ mutationFn: middleMileApi.completeTally, onSuccess: () => { toast.success('Loading tally completed and locked'); refresh(); }, onError: (error) => toast.error(errorMessage(error)) });
  const totalScanned = (row) => row.items?.reduce((sum, item) => sum + Number(item.scannedPackages || 0), 0) || 0;
  return <>
    <PageHeader title="Loading Tally" description="Scan every package from a sorted batch and reconcile quantity before manifestation."><button className="btn" onClick={() => setOpen(true)}><PackageCheck size={17} /> Create Tally</button></PageHeader>
    <section className="panel">{query.isPending ? <Loadingcrleleton /> : query.isError ? <ErrorState error={errorMessage(query.error)} retry={query.refetch} /> : <DataTable rows={rows(query)} pagination={query.data.pagination} onPage={setPage} columns={[
      { key: 'tallyNumber', label: 'Tally' }, { key: 'lane', label: 'Movement', render: (row) => `${row.fromHubId?.name || '—'} → ${row.toHubId?.name || '—'}` },
      { key: 'lrs', label: 'LRs', render: (row) => row.totalLrs }, { key: 'packages', label: 'Scanned / Expected', render: (row) => `${totalScanned(row)} / ${row.totalPackages}` },
      { key: 'weight', label: 'Weight', render: (row) => `${row.totalWeightKg} kg` }, { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
      { key: 'action', label: 'Actions', render: (row) => <div className="actions">{['DRAFT', 'LOADING'].includes(row.status) && <><button className="text-btn" onClick={() => setScanRow(row)}>Scan</button><button className="text-btn" onClick={() => complete.mutate(idOf(row))}>Complete</button></>}</div> },
    ]} />}</section>
    {open && <Modal title="Create Loading Tally" onClose={() => setOpen(false)}><form onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); create.mutate({ segregationId: form.get('segregationId'), loadingBay: form.get('loadingBay') || undefined, vehicleType: form.get('vehicleType') || undefined, vehicleCapacityKg: form.get('vehicleCapacityKg') || undefined }); }}><div className="form-grid"><label>Sorted Batch<select name="segregationId" required><option value="">Select batch</option>{rows(options).map((item) => <option key={idOf(item)} value={idOf(item)}>{item.segregationNumber} - {item.destination} ({item.shipmentIds.length} LRs)</option>)}</select></label><label>Loading Bay<input name="loadingBay" /></label><label>Vehicle Type<input name="vehicleType" /></label><label>Capacity (kg)<input name="vehicleCapacityKg" type="number" min="1" /></label></div><div className="modal-footer"><button type="button" className="btn secondary" onClick={() => setOpen(false)}>Cancel</button><button className="btn" disabled={create.isPending}>{busyLabel(create.isPending, 'Create Tally')}</button></div></form></Modal>}
    {scanRow && <Modal title={`Scan ${scanRow.tallyNumber}`} onClose={() => setScanRow(null)}><div className="stats-grid"><StatCard label="LRs" value={scanRow.totalLrs} /><StatCard label="Expected Packages" value={scanRow.totalPackages} /><StatCard label="Scanned" value={totalScanned(scanRow)} /></div><form onSubmit={(event) => { event.preventDefault(); const barcode = new FormData(event.currentTarget).get('barcode'); scan.mutate({ id: idOf(scanRow), barcode }); event.currentTarget.reset(); }}><div className="form-grid"><label className="full-span">Package Barcode<input name="barcode" required autoFocus /></label></div><div className="modal-footer"><button type="button" className="btn secondary" onClick={() => setScanRow(null)}>Close</button><button className="btn" disabled={scan.isPending}><ScanLine size={17} /> Scan Package</button></div></form></Modal>}
  </>;
}

function ManifestWorkspace() {
  const { user } = useAuth(); const canLock = ['ADMIN', 'MANAGER'].includes(user.role); const client = useQueryClient(); const [page, setPage] = useState(1), [open, setOpen] = useState(false);
  const query = useQuery({ queryKey: ['middle-mile-manifests', page], queryFn: () => middleMileApi.manifests.list({ page, limit: 20 }) });
  const tallies = useQuery({ queryKey: ['loading-tallies', 'manifest-ready'], queryFn: () => middleMileApi.tallies.list({ limit: 100 }) });
  const refresh = () => { client.invalidateQueries({ queryKey: ['middle-mile-manifests'] }); client.invalidateQueries({ queryKey: ['loading-tallies'] }); };
  const create = useMutation({ mutationFn: middleMileApi.manifests.create, onSuccess: () => { toast.success('Draft manifest created from tally'); setOpen(false); refresh(); }, onError: (error) => toast.error(errorMessage(error)) });
  const finalize = useMutation({ mutationFn: middleMileApi.finalizeManifest, onSuccess: () => { toast.success('Manifest finalized and locked'); refresh(); }, onError: (error) => toast.error(errorMessage(error)) });
  const eligibleTallies = rows(tallies).filter((row) => row.status === 'TALLY_COMPLETED');
  return <>
    <PageHeader title="Middle Mile Manifest" description="Create from a completed loading tally; no LR information needs to be entered again."><button className="btn" onClick={() => setOpen(true)}><ClipboardCheck size={17} /> Create Manifest</button></PageHeader>
    <section className="panel">{query.isPending ? <Loadingcrleleton /> : query.isError ? <ErrorState error={errorMessage(query.error)} retry={query.refetch} /> : <DataTable rows={rows(query)} pagination={query.data.pagination} onPage={setPage} columns={[
      { key: 'manifestNumber', label: 'Manifest' }, { key: 'date', label: 'Created', render: (row) => date(row.createdAt) },
      { key: 'lane', label: 'Movement', render: (row) => `${row.fromHubId?.name || '—'} → ${row.toHubId?.name || row.destination}` },
      { key: 'lrs', label: 'LRs', render: (row) => row.totalLrs }, { key: 'packages', label: 'Packages', render: (row) => row.totalPackages },
      { key: 'weight', label: 'Weight', render: (row) => `${row.totalWeightKg} kg` }, { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.workflowStatus || row.status} /> },
      { key: 'action', label: '', render: (row) => canLock && row.workflowStatus === 'DRAFT' ? <button className="text-btn" onClick={() => finalize.mutate(idOf(row))}>Finalize & Lock</button> : null },
    ]} />}</section>
    {open && <Modal title="Create Manifest from Loading Tally" onClose={() => setOpen(false)}><form onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); create.mutate({ loadingTallyId: form.get('loadingTallyId'), vendorReference: form.get('vendorReference') || undefined, remarks: form.get('remarks') || undefined }); }}><div className="form-grid"><label>Completed Loading Tally<select name="loadingTallyId" required><option value="">Select tally</option>{eligibleTallies.map((row) => <option key={idOf(row)} value={idOf(row)}>{row.tallyNumber} - {row.totalLrs} LRs / {row.totalPackages} packages</option>)}</select></label><label>Vendor Reference<input name="vendorReference" /></label><label className="full-span">Remarks<textarea name="remarks" /></label></div><div className="modal-footer"><button type="button" className="btn secondary" onClick={() => setOpen(false)}>Cancel</button><button className="btn" disabled={create.isPending}>{busyLabel(create.isPending, 'Create Draft')}</button></div></form></Modal>}
  </>;
}

function TripWorkspace({ inwardOnly = false }) {
  const { user } = useAuth(); const canDispatch = ['ADMIN', 'MANAGER'].includes(user.role); const client = useQueryClient();
  const [page, setPage] = useState(1), [open, setOpen] = useState(false), [source, setSource] = useState('VV'), [vendorId, setVendorId] = useState(''), [inwardRow, setInwardRow] = useState(null);
  const query = useQuery({ queryKey: ['middle-mile-trips', page], queryFn: () => middleMileApi.trips.list({ page, limit: 20 }) });
  const manifests = useQuery({ queryKey: ['middle-mile-manifests', 'eligible'], queryFn: () => middleMileApi.manifests.list({ limit: 100 }) });
  const vendors = useQuery({ queryKey: ['vendor-options'], queryFn: vendorOptionsApi.list });
  const refresh = () => { client.invalidateQueries({ queryKey: ['middle-mile-trips'] }); client.invalidateQueries({ queryKey: ['middle-mile-manifests'] }); client.invalidateQueries({ queryKey: ['middle-mile-sorting-inventory'] }); };
  const create = useMutation({ mutationFn: middleMileApi.trips.create, onSuccess: () => { toast.success('Middle Mile trip ready for dispatch'); setOpen(false); refresh(); }, onError: (error) => toast.error(errorMessage(error)) });
  const action = useMutation({ mutationFn: ({ type, row, receivedShipmentIds }) => type === 'dispatch' ? middleMileApi.dispatchTrip(idOf(row)) : type === 'arrive' ? middleMileApi.arriveTrip(idOf(row)) : middleMileApi.destinationInward(idOf(row), receivedShipmentIds), onSuccess: (_, variables) => { toast.success(variables.type === 'inward' ? 'Destination inward completed' : `Trip marked ${variables.type}`); setInwardRow(null); refresh(); }, onError: (error) => toast.error(errorMessage(error)) });
  const availableManifests = rows(manifests).filter((row) => row.workflowStatus === 'LOCKED' && !row.tripId);
  const selectedVendor = rows(vendors).find((row) => idOf(row) === vendorId);
  const visibleTrips = inwardOnly ? rows(query).filter((row) => ['DISPATCHED', 'ARRIVED'].includes(row.status)) : rows(query);
  const save = (event) => {
    event.preventDefault(); const form = new FormData(event.currentTarget); const selectedManifestIds = form.getAll('manifestIds');
    const vehicle = selectedVendor?.vehicles?.find((row) => row.vehicleNumber === form.get('vehicleNumber'));
    create.mutate({ manifestIds: selectedManifestIds, vehicleSource: source, vendorId: form.get('vendorId') || undefined, vehicleNumber: form.get('vehicleNumber'), vehicleType: form.get('vehicleType') || vehicle?.vehicleType || undefined, vehicleCapacityKg: form.get('vehicleCapacityKg') || vehicle?.capacityKg || undefined, driverName: form.get('driverName') || vehicle?.driverName, driverMobile: form.get('driverMobile') || vehicle?.driverMobile || undefined, departureDate: form.get('departureDate'), expectedArrival: form.get('expectedArrival') || undefined, freightAmount: form.get('freightAmount') || 0, advanceAmount: form.get('advanceAmount') || 0, remarks: form.get('remarks') || undefined });
  };
  return <>
    <PageHeader title={inwardOnly ? 'Destination Hub Inward' : 'Middle Mile Trip Creation'} description={inwardOnly ? 'Receive arrived trip shipments without marking them delivered.' : 'Combine compatible locked manifests, assign VV/MV vehicle and dispatch atomically.'}>{!inwardOnly && <button className="btn" onClick={() => setOpen(true)}><Truck size={17} /> Create Trip</button>}</PageHeader>
    <section className="panel">{query.isPending ? <Loadingcrleleton /> : query.isError ? <ErrorState error={errorMessage(query.error)} retry={query.refetch} /> : <DataTable rows={visibleTrips} pagination={inwardOnly ? undefined : query.data.pagination} onPage={setPage} empty={inwardOnly ? 'No dispatched or arrived trips' : 'No Middle Mile trips'} columns={[
      { key: 'tripNumber', label: 'Trip' }, { key: 'lane', label: 'Movement', render: (row) => `${row.fromHubId?.name || row.origin} → ${row.toHubId?.name || row.destination}` },
      { key: 'vehicle', label: 'Vehicle / Source', render: (row) => `${row.vehicleNumber} / ${row.vehicleSource || 'Legacy'}` }, { key: 'driverName', label: 'Driver' },
      { key: 'manifest', label: 'Manifests', render: (row) => row.manifestIds?.length || 0 }, { key: 'packages', label: 'Packages', render: (row) => row.totalPackages },
      { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.workflowStatus || row.status} /> },
      { key: 'action', label: 'Actions', render: (row) => <div className="actions">{!inwardOnly && canDispatch && row.status === 'PLANNED' && <button className="text-btn" onClick={() => action.mutate({ type: 'dispatch', row })}>Dispatch</button>}{row.status === 'DISPATCHED' && <button className="text-btn" onClick={() => action.mutate({ type: 'arrive', row })}>Mark Arrived</button>}{row.status === 'ARRIVED' && <button className="text-btn" onClick={() => setInwardRow(row)}>Verify & Inward</button>}</div> },
    ]} />}</section>
    {open && <Modal title="Create Middle Mile Trip" onClose={() => setOpen(false)}><form onSubmit={save}><div className="form-grid"><fieldset className="full-span"><legend>Eligible Locked Manifests</legend>{availableManifests.length ? availableManifests.map((row) => <label key={idOf(row)}><input type="checkbox" name="manifestIds" value={idOf(row)} /> {row.manifestNumber} - {row.totalPackages} packages / {row.totalWeightKg} kg</label>) : <p>No compatible locked manifests available.</p>}</fieldset><label>Vehicle Source<select value={source} onChange={(event) => setSource(event.target.value)}><option value="VV">VV - Vendor Vehicle</option><option value="MV">MV - Market Vehicle</option></select></label><label>Vendor<select name="vendorId" value={vendorId} onChange={(event) => setVendorId(event.target.value)} required={source === 'VV'}><option value="">{source === 'VV' ? 'Select vendor' : 'Optional transporter'}</option>{rows(vendors).map((row) => <option key={idOf(row)} value={idOf(row)}>{row.vendorCode} - {row.name}</option>)}</select></label>{source === 'VV' && selectedVendor?.vehicles?.length ? <label>Vehicle<select name="vehicleNumber" required><option value="">Select mapped vehicle</option>{selectedVendor.vehicles.filter((row) => row.status === 'ACTIVE').map((row) => <option key={row.vehicleNumber} value={row.vehicleNumber}>{row.vehicleNumber} - {row.vehicleType || 'Vehicle'} ({row.capacityKg || 0} kg)</option>)}</select></label> : <label>Vehicle Number<input name="vehicleNumber" required /></label>}<label>Vehicle Type<input name="vehicleType" /></label><label>Capacity (kg)<input name="vehicleCapacityKg" type="number" min="1" /></label><label>Driver Name<input name="driverName" required={source === 'MV'} /></label><label>Driver Mobile<input name="driverMobile" /></label><label>Planned Departure<input name="departureDate" type="datetime-local" required /></label><label>Expected Arrival<input name="expectedArrival" type="datetime-local" /></label><label>Freight Amount<input name="freightAmount" type="number" min="0" defaultValue="0" /></label><label>Advance Amount<input name="advanceAmount" type="number" min="0" defaultValue="0" /></label><label className="full-span">Remarks<textarea name="remarks" /></label></div><div className="modal-footer"><button type="button" className="btn secondary" onClick={() => setOpen(false)}>Cancel</button><button className="btn" disabled={create.isPending || !availableManifests.length}>{busyLabel(create.isPending, 'Confirm Trip')}</button></div></form></Modal>}
    {inwardRow && <Modal title={`Verify ${inwardRow.tripNumber}`} onClose={() => setInwardRow(null)}><p>Select every physically received LR. The server will reject shortages or unexpected records.</p><form onSubmit={(event) => { event.preventDefault(); const receivedShipmentIds = new FormData(event.currentTarget).getAll('receivedShipmentIds'); action.mutate({ type: 'inward', row: inwardRow, receivedShipmentIds }); }}><fieldset><legend>Expected LRs ({inwardRow.shipmentIds.length})</legend>{inwardRow.shipmentIds.map((shipment) => <label key={idOf(shipment)}><input type="checkbox" name="receivedShipmentIds" value={idOf(shipment)} /> {shipment.lrNumber} - {shipment.packageCount} packages / {shipment.weightKg} kg</label>)}</fieldset><div className="modal-footer"><button type="button" className="btn secondary" onClick={() => setInwardRow(null)}>Cancel</button><button className="btn" disabled={action.isPending}>{busyLabel(action.isPending, 'Confirm Destination Inward')}</button></div></form></Modal>}
  </>;
}

export default function MiddleMilePage() {
  const path = useLocation().pathname.split('/').at(-1);
  if (path === 'hub-inward') return <InwardWorkspace />;
  if (path === 'segregations') return <SortingWorkspace />;
  if (path === 'loading-tallies') return <TallyWorkspace />;
  if (path === 'manifests') return <ManifestWorkspace />;
  if (path === 'destination-inward') return <TripWorkspace inwardOnly />;
  return <TripWorkspace />;
}
