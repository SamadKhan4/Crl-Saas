import { useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import TripVehicleFields from '../components/tms/TripVehicleFields';
import TransportPdfDownload from '../components/tms/TransportPdfDownload';
import { masterOptionsApi, middleMileApi, vendorOptionsApi, manifestsApi } from '../api/services';
import { errorMessage } from '../api/client';
import { useAuth } from '../features/auth/AuthContext';
import { date, idOf } from '../lib/workflow';
import { DataTable, ErrorState, Loadingcrleleton, Modal, PageHeader, StatusBadge } from '../components/common/UI';

const rows = (query) => query.data?.data || [];
async function allRows(list, params = {}) {
  const first = await list({ ...params, page: 1, limit: 100 });
  const data = [...first.data];
  for (let page = 2; page <= (first.pagination?.pages || 1); page++) data.push(...(await list({ ...params, page, limit: 100 })).data);
  return { ...first, data };
}
function useRefresh() {
  const cache = useQueryClient();
  return () => ['loading-tallies', 'middle-mile-manifests', 'middle-mile-trips', 'middle-mile-sorting-inventory', 'middle-mile-sortings', 'last-mile-arrivals', 'last-mile-pending-arrivals'].forEach((key) => cache.invalidateQueries({ queryKey: [key] }));
}
const lrColumns = [
  { key: 'lrNumber', label: 'LR number' }, { key: 'destination', label: 'Destination', render: (lr) => lr.lrDetails?.to || lr.destinationBranchId?.city || '-' }, { key: 'receiverName', label: 'Receiver' },
  { key: 'packageCount', label: 'Packages' }, { key: 'weightKg', label: 'Weight (kg)' },
];

function RouteSortingWorkspace() {
  const [destination, setDestination] = useState('');
  const [pincode, setPincode] = useState('');
  const [selected, setSelected] = useState([]);
  const refresh = useRefresh();
  const available = useQuery({ queryKey: ['middle-mile-sorting-inventory', 'cities'], queryFn: () => allRows(middleMileApi.sortingInventory) });
  const cities = [...new Set(rows(available).map((lr) => lr.lrDetails?.to || lr.destinationBranchId?.city).filter(Boolean))].sort();
  const inventory = useQuery({ queryKey: ['middle-mile-sorting-inventory', destination, pincode], queryFn: () => allRows(middleMileApi.sortingInventory, { destination, ...(pincode && { destinationPincode: pincode }) }), enabled: Boolean(destination) && (!pincode || /^\d{6}$/.test(pincode)) });
  const batches = useQuery({ queryKey: ['middle-mile-sortings'], queryFn: () => allRows(middleMileApi.sortings) });
  const create = useMutation({ mutationFn: () => middleMileApi.sort({ destination, ...(pincode && { destinationPincode: pincode }), shipmentIds: selected }), onSuccess: (result) => { toast.success(`Sorting ${result.data.segregationNumber} saved. Create its loading tally next.`); setSelected([]); refresh(); }, onError: (error) => { toast.error(errorMessage(error)); inventory.refetch(); } });
  return <>
    <PageHeader title="City-wise Sorting" description="Sort available LRs by destination city and PIN code before creating a city loading tally." />
    <section className="panel form-section">
      {available.isError ? <ErrorState error={errorMessage(available.error)} retry={available.refetch} /> : <div className="form-grid">
        <label>Destination city<select required value={destination} onChange={(event) => { setDestination(event.target.value); setPincode(''); setSelected([]); }}><option value="">Select destination city</option>{cities.map((city) => <option key={city} value={city}>{city}</option>)}</select></label>
        <label>Destination PIN code (optional)<input value={pincode} inputMode="numeric" maxLength={6} pattern="[0-9]{6}" placeholder="All PIN codes in this city" onChange={(event) => { setPincode(event.target.value.replace(/\D/g, '')); setSelected([]); }} /></label>
      </div>}
      {pincode && pincode.length !== 6 && <p>Enter a six-digit destination PIN code.</p>}
      {destination && (!pincode || pincode.length === 6) && (inventory.isPending ? <Loadingcrleleton /> : inventory.isError ? <ErrorState error={errorMessage(inventory.error)} retry={inventory.refetch} /> : <DataTable rows={rows(inventory)} empty="No available LRs for this destination" columns={[
        { key: 'select', label: 'Select LR', render: (lr) => <input type="checkbox" aria-label={`Select ${lr.lrNumber}`} checked={selected.includes(idOf(lr))} onChange={(event) => setSelected((current) => event.target.checked ? [...current, idOf(lr)] : current.filter((value) => value !== idOf(lr)))} /> },
        ...lrColumns, { key: 'pincode', label: 'Destination PIN', render: (lr) => lr.lrDetails?.consigneePincode || '-' },
      ]} />)}
      <div className="form-actions"><span>{selected.length} LRs selected</span><button className="btn" disabled={!destination || !selected.length || create.isPending || inventory.isFetching || (pincode && pincode.length !== 6)} onClick={() => create.mutate()}>{create.isPending ? 'Saving...' : 'Save Sorting'}</button></div>
    </section>
    <section className="panel"><h2>Sorted LRs awaiting loading tally</h2>{batches.isError ? <ErrorState error={errorMessage(batches.error)} retry={batches.refetch} /> : <DataTable rows={rows(batches)} columns={[
      { key: 'segregationNumber', label: 'Sorting number' }, { key: 'destination', label: 'Destination city' }, { key: 'destinationPincode', label: 'PIN code', render: (row) => row.destinationPincode || 'All' }, { key: 'lrs', label: 'Selected LRs', render: (row) => (row.shipmentIds || []).map((lr) => lr.lrNumber).join(', ') },
    ]} />}</section>
  </>;
}

function TallyDocument({ tallyId, onClose }) {
  const printRef = useRef(null);
  const query = useQuery({ queryKey: ['loading-tallies', 'detail', tallyId], queryFn: () => middleMileApi.tallies.detail(tallyId) });
  const tally = query.data?.data;
  return <Modal title={tally?.tallyNumber || 'Loading tally'} onClose={onClose}>
    {query.isPending ? <Loadingcrleleton /> : query.isError ? <ErrorState error={errorMessage(query.error)} retry={query.refetch} /> : <>
      <div className="actions tally-document-actions"><button className="btn secondary" onClick={() => window.print()}>Print Tally</button><TransportPdfDownload targetRef={printRef} documentNumber={tally.tallyNumber} label="Download Tally PDF" /></div>
      <div ref={printRef} className="transport-document-shell"><div className="transport-print-document prs-document tally-print-document">
        <header className="tally-brand"><img src="/crl-logo.png" alt="CRL" /><div><h1>CHAPLE ROADLINES PVT. LTD.</h1><span>Middle Mile Operations</span></div><strong>LOADING TALLY</strong></header>
        <section className="tally-heading"><div><small>Tally number</small><h2>{tally.tallyNumber}</h2></div><div><small>Destination city</small><b>{tally.destination || '-'}</b><span>{tally.origin || '-'} to {tally.destination || '-'}</span></div></section>
        <section className="tally-info-grid">{[
          ['Sorting number', tally.segregationId?.segregationNumber || '-'], ['Date', date(tally.createdAt)],
          ['Loading bay', tally.loadingBay || '-'], ['Vehicle type', tally.vehicleType || '-'],
          ['Capacity (kg)', tally.vehicleCapacityKg ?? '-'], ['Status', tally.status?.replaceAll('_', ' ') || '-'],
        ].map(([label, value]) => <div key={label}><small>{label}</small><b>{value}</b></div>)}</section>
        <table className="tally-lr-table">
          <colgroup><col style={{ width: '6%' }} /><col style={{ width: '21%' }} /><col style={{ width: '23%' }} /><col style={{ width: '26%' }} /><col style={{ width: '11%' }} /><col style={{ width: '13%' }} /></colgroup>
          <thead><tr><th>Sr.</th><th>LR number</th><th>Destination</th><th>Receiver</th><th className="numeric">Packages</th><th className="numeric">Weight (kg)</th></tr></thead>
          <tbody>{(tally.items || []).map((item, index) => <tr key={idOf(item.shipmentId) || index}><td>{index + 1}</td><td className="tally-lr-number">{item.shipmentId?.lrNumber || '-'}</td><td>{item.shipmentId?.lrDetails?.to || item.shipmentId?.destinationBranchId?.city || tally.destination || '-'}</td><td>{item.shipmentId?.receiverName || '-'}</td><td className="numeric">{item.expectedPackages ?? 0}</td><td className="numeric">{Number(item.weightKg || 0).toLocaleString('en-IN')}</td></tr>)}
          {!(tally.items || []).length && <tr><td colSpan={6}>No LRs added to this tally.</td></tr>}</tbody>
          <tfoot><tr><td colSpan={4}>Total: {tally.totalLrs ?? tally.items?.length ?? 0} LRs</td><td className="numeric">{tally.totalPackages ?? 0}</td><td className="numeric">{Number(tally.totalWeightKg || 0).toLocaleString('en-IN')}</td></tr></tfoot>
        </table>
        <footer className="tally-signatures"><div><span>Prepared by</span><b>Signature / Name</b></div><div><span>Loading supervisor</span><b>Signature / Name</b></div></footer>
      </div></div>
    </>}
  </Modal>;
}

function TallyWorkspace() {
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [destination, setDestination] = useState('');
  const [batchId, setBatchId] = useState('');
  const [excludedLrs, setExcludedLrs] = useState([]);
  const [viewId, setViewId] = useState(null);
  const [error, setError] = useState('');
  const refresh = useRefresh();
  const register = useQuery({ queryKey: ['loading-tallies', page], queryFn: () => middleMileApi.tallies.list({ page, limit: 20 }) });
  const batches = useQuery({ queryKey: ['middle-mile-sortings'], queryFn: () => allRows(middleMileApi.sortings), enabled: open });
  const availableCities = [...new Set(rows(batches).map((row) => row.destination).filter(Boolean))].sort();
  const cityBatches = rows(batches).filter((row) => row.destination === destination);
  const selectedBatch = cityBatches.find((row) => idOf(row) === batchId) || (cityBatches.length === 1 ? cityBatches[0] : null);
  const selectedLrs = (selectedBatch?.shipmentIds || []).filter((lr) => !excludedLrs.includes(idOf(lr)));
  const create = useMutation({ mutationFn: middleMileApi.tallies.create, onSuccess: (result) => { toast.success(`Loading tally ${result.data.tallyNumber} created`); setOpen(false); setViewId(idOf(result.data)); refresh(); }, onError: (reason) => { setError(errorMessage(reason)); batches.refetch(); } });
  return <>
    <PageHeader title="Loading Tally" description="Create a loading tally from previously sorted LRs, then view or print it."><button className="btn" onClick={() => { setDestination(''); setBatchId(''); setExcludedLrs([]); setError(''); setOpen(true); }}>Create Loading Tally</button></PageHeader>
    <section className="panel">{register.isPending ? <Loadingcrleleton /> : register.isError ? <ErrorState error={errorMessage(register.error)} retry={register.refetch} /> : <DataTable rows={rows(register)} pagination={register.data?.pagination} onPage={setPage} columns={[
      { key: 'tallyNumber', label: 'Loading tally number' }, { key: 'destination', label: 'Destination city' }, { key: 'loadingBay', label: 'Loading bay' }, { key: 'vehicleType', label: 'Vehicle type' }, { key: 'vehicleCapacityKg', label: 'Capacity (kg)' },
      { key: 'totalLrs', label: 'LRs' }, { key: 'totalWeightKg', label: 'Weight (kg)' }, { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
      { key: 'actions', label: 'Actions', render: (row) => <div className="actions"><button className="text-btn" onClick={() => setViewId(idOf(row))}>View Tally</button><button className="text-btn" onClick={() => setViewId(idOf(row))}>Print Tally</button></div> },
    ]} />}</section>
    {open && <Modal title="Create Loading Tally" onClose={() => setOpen(false)}>{batches.isPending ? <Loadingcrleleton /> : batches.isError ? <ErrorState error={errorMessage(batches.error)} retry={batches.refetch} /> : <form onSubmit={(event) => {
      event.preventDefault(); const form = new FormData(event.currentTarget);
      create.mutate({ segregationId: idOf(selectedBatch), shipmentIds: selectedLrs.map(idOf), loadingBay: form.get('loadingBay'), vehicleType: form.get('vehicleType'), vehicleCapacityKg: Number(form.get('vehicleCapacityKg')) });
    }}>
      {!rows(batches).length && <p>Save city-wise sorting first. No sorted LRs are awaiting loading.</p>}
      <div className="form-grid">
        <label>Destination city<select required value={destination} onChange={(event) => { setDestination(event.target.value); setBatchId(''); setExcludedLrs([]); }}><option value="">Select destination city</option>{availableCities.map((city) => <option key={city} value={city}>{city}</option>)}</select></label>
        {cityBatches.length > 1 && <label>Sorted LR batch<select required value={batchId} onChange={(event) => { setBatchId(event.target.value); setExcludedLrs([]); }}><option value="">Select sorting batch</option>{cityBatches.map((row) => <option key={idOf(row)} value={idOf(row)}>{row.segregationNumber} - {row.shipmentIds.length} LRs / PIN: {row.destinationPincode || 'All'}</option>)}</select></label>}
        <label>Loading bay<input name="loadingBay" required maxLength={80} list="loading-bays" placeholder="Select or enter bay" /><datalist id="loading-bays">{['Bay 1', 'Bay 2', 'Bay 3', 'Bay 4'].map((bay) => <option key={bay} value={bay} />)}</datalist></label>
        <label>Vehicle type<input name="vehicleType" required maxLength={80} list="loading-vehicle-types" placeholder="Select or enter vehicle type" /><datalist id="loading-vehicle-types">{['Pickup', 'Tata Ace', 'LCV', 'Truck', 'Container', 'Trailer'].map((type) => <option key={type} value={type} />)}</datalist></label>
        <label>Capacity (kg)<input name="vehicleCapacityKg" type="number" required min="0.01" max="1000000" step="any" /></label>
      </div>
      {selectedBatch && <><h3>Select LRs for this tally</h3><div className="actions"><button type="button" className="text-btn" onClick={() => setExcludedLrs([])}>Select all</button><button type="button" className="text-btn" onClick={() => setExcludedLrs((selectedBatch.shipmentIds || []).map(idOf))}>Unselect all</button></div><DataTable rows={selectedBatch.shipmentIds || []} columns={[
        { key: 'select', label: 'Select LR', render: (lr) => <input type="checkbox" aria-label={`Include ${lr.lrNumber} in tally`} checked={!excludedLrs.includes(idOf(lr))} onChange={(event) => setExcludedLrs((current) => event.target.checked ? current.filter((value) => value !== idOf(lr)) : [...current, idOf(lr)])} /> }, ...lrColumns,
      ]} /><p>{selectedLrs.length} LRs selected / Total weight: {selectedLrs.reduce((sum, lr) => sum + Number(lr.weightKg || 0), 0)} kg</p><small>Unselected LRs remain available for a later loading tally.</small></>}
      {error && <p role="alert" className="field-error">{error}</p>}
      <div className="modal-footer"><button className="btn" disabled={!selectedBatch || !selectedLrs.length || create.isPending || batches.isFetching}>{create.isPending ? 'Creating...' : 'Create Tally'}</button></div>
    </form>}</Modal>}
    {viewId && <TallyDocument tallyId={viewId} onClose={() => setViewId(null)} />}
  </>;
}

function ManifestDocument({ manifestId, onClose }) {
  const query = useQuery({ queryKey: ['middle-mile-manifests', 'detail', manifestId], queryFn: () => manifestsApi.detail(manifestId) });
  const manifest = query.data?.data;
  return <Modal title={manifest?.manifestNumber || 'View Manifest'} onClose={onClose}>
    {query.isPending ? <Loadingcrleleton /> : query.isError ? <ErrorState error={errorMessage(query.error)} retry={query.refetch} /> : (
      <div className="transport-document-shell"><div className="transport-print-document prs-document tally-print-document">
        <header className="tally-brand"><img src="/crl-logo.png" alt="CRL" /><div><h1>CHAPLE ROADLINES PVT. LTD.</h1><span>Middle Mile Operations</span></div><strong>MANIFEST</strong></header>
        <section className="tally-heading"><div><small>Manifest number</small><h2>{manifest.manifestNumber}</h2></div><div><small>Destination city</small><b>{manifest.destination || '-'}</b><span>{manifest.origin || '-'} to {manifest.destination || '-'}</span></div></section>
        <section className="tally-info-grid">{[
          ['Loading tally', manifest.loadingTallyId?.tallyNumber || '-'], ['Sorting number', manifest.segregationId?.segregationNumber || '-'], ['Date', date(manifest.createdAt)],
          ['Status', (manifest.workflowStatus || manifest.status || '-').replaceAll('_', ' ')], ['Vendor', manifest.vendorId?.name || '-'], ['Route', manifest.routeId?.name || 'Assigned during trip creation'],
        ].map(([label, value]) => <div key={label}><small>{label}</small><b>{value}</b></div>)}</section>
        <table className="tally-lr-table"><colgroup><col style={{ width: '6%' }} /><col style={{ width: '21%' }} /><col style={{ width: '23%' }} /><col style={{ width: '26%' }} /><col style={{ width: '11%' }} /><col style={{ width: '13%' }} /></colgroup>
          <thead><tr><th>Sr.</th><th>LR number</th><th>Destination</th><th>Receiver</th><th className="numeric">Packages</th><th className="numeric">Weight (kg)</th></tr></thead>
          <tbody>{(manifest.shipmentIds || []).map((lr, index) => <tr key={idOf(lr) || index}><td>{index + 1}</td><td className="tally-lr-number">{lr.lrNumber || '-'}</td><td>{lr.lrDetails?.to || manifest.destination || '-'}</td><td>{lr.receiverName || '-'}</td><td className="numeric">{lr.packageCount ?? 0}</td><td className="numeric">{Number(lr.weightKg || 0).toLocaleString('en-IN')}</td></tr>)}
            {!manifest.shipmentIds?.length && <tr><td colSpan={6}>No LRs in this manifest.</td></tr>}</tbody>
          <tfoot><tr><td colSpan={4}>Total: {manifest.totalLrs ?? manifest.shipmentIds?.length ?? 0} LRs</td><td className="numeric">{manifest.totalPackages ?? 0}</td><td className="numeric">{Number(manifest.totalWeightKg || 0).toLocaleString('en-IN')}</td></tr></tfoot>
        </table>
      </div></div>
    )}
  </Modal>;
}

function ManifestWorkspace() {
  const [tallyId, setTallyId] = useState('');
  const [verified, setVerified] = useState([]);
  const [eWayUpdates, setEWayUpdates] = useState({});
  const [page, setPage] = useState(1);
  const [viewId, setViewId] = useState(null);
  const refresh = useRefresh();
  const tallies = useQuery({ queryKey: ['loading-tallies', 'available'], queryFn: () => allRows(middleMileApi.tallies.list, { status: 'TALLY_COMPLETED' }) });
  const detail = useQuery({ queryKey: ['loading-tallies', 'detail', tallyId], queryFn: () => middleMileApi.tallies.detail(tallyId), enabled: Boolean(tallyId) });
  const register = useQuery({ queryKey: ['middle-mile-manifests', page], queryFn: () => middleMileApi.manifests.list({ page, limit: 20 }) });
  const lrs = (detail.data?.data?.items || []).map((item) => item.shipmentId);
  const create = useMutation({ mutationFn: () => middleMileApi.manifests.create({ loadingTallyId: tallyId, verifiedShipmentIds: verified, eWayUpdates: lrs.filter((lr) => Number(lr.lrDetails?.declaredValue || 0) > 50000).map((lr) => ({ shipmentId: idOf(lr), eWayBillNo: (eWayUpdates[idOf(lr)] ?? lr.lrDetails?.eWayBillNo ?? '').trim() })) }), onSuccess: (result) => { toast.success(`Manifest ${result.data.manifestNumber} created`); setTallyId(''); setVerified([]); setEWayUpdates({}); refresh(); }, onError: (error) => toast.error(errorMessage(error)) });
  return <>
    <PageHeader title="Manifest Creation" description="Select a loading tally and verify every loaded LR before submitting." />
    <section className="panel form-section">
      {tallies.isError ? <ErrorState error={errorMessage(tallies.error)} retry={tallies.refetch} /> : <div className="form-grid"><label>Loading tally<select value={tallyId} onChange={(event) => { setTallyId(event.target.value); setVerified([]); setEWayUpdates({}); }}><option value="">Select loading tally</option>{rows(tallies).map((row) => <option key={idOf(row)} value={idOf(row)}>{row.tallyNumber} - {row.totalLrs} LRs</option>)}</select></label><label>Vendor from PRS<input aria-label="Vendor from PRS" value={detail.data?.data?.sourceVendor ? `${detail.data.data.sourceVendor.vendorCode} · ${detail.data.data.sourceVendor.name}` : detail.isPending ? 'Loading…' : 'Not available in source PRS'} readOnly /></label></div>}
      {tallyId && (detail.isPending ? <Loadingcrleleton /> : detail.isError ? <ErrorState error={errorMessage(detail.error)} retry={detail.refetch} /> : <DataTable rows={lrs} columns={[
        { key: 'verify', label: 'Loaded / verified', render: (lr) => <input type="checkbox" aria-label={`Verify ${lr.lrNumber}`} checked={verified.includes(idOf(lr))} onChange={(event) => setVerified((current) => event.target.checked ? [...current, idOf(lr)] : current.filter((value) => value !== idOf(lr)))} /> }, ...lrColumns,
        { key: 'declaredValue', label: 'Goods value (INR)', render: (lr) => lr.lrDetails?.declaredValue == null ? 'Not entered' : Number(lr.lrDetails.declaredValue).toLocaleString('en-IN') },
        { key: 'eWayUpdate', label: 'E-way update', render: (lr) => Number(lr.lrDetails?.declaredValue || 0) > 50000 ? <label>Yes - update E-way number<input aria-label={`E-way number for ${lr.lrNumber}`} maxLength={120} value={eWayUpdates[idOf(lr)] ?? lr.lrDetails?.eWayBillNo ?? ''} onChange={(event) => setEWayUpdates((current) => ({ ...current, [idOf(lr)]: event.target.value }))} placeholder="Enter E-way bill number" /></label> : lr.lrDetails?.declaredValue == null ? 'Value not entered' : 'No' },
      ]} />)}
      <div className="form-actions"><span>{verified.length} / {lrs.length} LRs verified</span><button className="btn" disabled={lrs.some((lr) => Number(lr.lrDetails?.declaredValue || 0) > 50000 && !(eWayUpdates[idOf(lr)] ?? lr.lrDetails?.eWayBillNo ?? '').trim()) || !lrs.length || verified.length !== lrs.length || detail.isFetching || create.isPending} onClick={() => create.mutate()}>{create.isPending ? 'Creating...' : 'Create Manifest'}</button></div>
    </section>
    <section className="panel">{register.isError ? <ErrorState error={errorMessage(register.error)} retry={register.refetch} /> : <DataTable rows={rows(register)} pagination={register.data?.pagination} onPage={setPage} columns={[
      { key: 'manifestNumber', label: 'Manifest number' }, { key: 'destination', label: 'Destination' }, { key: 'vendor', label: 'Vendor', render: (row) => row.vendorId?.name || row.tripId?.vendorId?.name || 'Market vehicle' }, { key: 'totalLrs', label: 'LRs' }, { key: 'totalPackages', label: 'Packages' },
      { key: 'totalWeightKg', label: 'Weight (kg)', render: (row) => Number(row.totalWeightKg || 0).toLocaleString('en-IN') },
      { key: 'actions', label: 'Actions', render: (row) => <button className="text-btn" onClick={() => setViewId(idOf(row))}>View Manifest</button> },
      { key: 'workflowStatus', label: 'Status', render: (row) => <StatusBadge status={row.workflowStatus} /> },
    ]} />}</section>
    {viewId && <ManifestDocument manifestId={viewId} onClose={() => setViewId(null)} />}
  </>;
}

function TripDocument({ trip, onClose }) {
  const printRef = useRef(null);
  return <Modal title={trip.tripNumber} onClose={onClose}>
    <div className="actions tally-document-actions"><button className="btn secondary" onClick={() => window.print()}>Print Trip</button><TransportPdfDownload targetRef={printRef} documentNumber={trip.tripNumber} label="Download Trip PDF" /></div>
    <div ref={printRef} className="transport-document-shell"><div className="transport-print-document prs-document trip-print-document">
      <header className="tally-brand"><img src="/crl-logo.png" alt="CRL" /><div><h1>CHAPLE ROADLINES PVT. LTD.</h1><span>Middle Mile Operations</span></div><strong>TRIP SHEET</strong></header>
      <section className="tally-heading"><div><small>Trip number</small><h2>{trip.tripNumber}</h2></div><div><small>Route / Destination</small><b>{trip.origin || '-'} to {trip.destination || '-'}</b><span>{trip.routeId?.name || 'Middle mile trip'}</span></div></section>
      <section className="tally-info-grid">{[
        ['Vehicle / Type', `${trip.vehicleNumber || '-'} / ${trip.vehicleType || trip.vehicleSource || '-'}`],
        ['Vendor', trip.vendorId?.name || 'Market vehicle'], ['Driver', [trip.driverName, trip.driverMobile].filter(Boolean).join(' / ') || '-'],
        ['Seal number', trip.sealNumber || '-'], ['Departure', date(trip.departureDate)],
        ['Trip cost', `INR ${Number(trip.freightAmount || 0).toLocaleString('en-IN')}`],
      ].map(([label, value]) => <div key={label}><small>{label}</small><b>{value}</b></div>)}</section>
      <table className="tally-lr-table trip-manifest-table">
        <colgroup><col style={{ width: '6%' }} /><col style={{ width: '30%' }} /><col style={{ width: '25%' }} /><col style={{ width: '10%' }} /><col style={{ width: '13%' }} /><col style={{ width: '16%' }} /></colgroup>
        <thead><tr><th>Sr.</th><th>Manifest number</th><th>Destination</th><th className="numeric">LRs</th><th className="numeric">Packages</th><th className="numeric">Weight (kg)</th></tr></thead>
        <tbody>{(trip.manifestIds || []).map((manifest, index) => <tr key={idOf(manifest) || index}>
          <td>{index + 1}</td><td className="tally-lr-number">{manifest.manifestNumber || '-'}</td><td>{manifest.destination || trip.destination || '-'}</td>
          <td className="numeric">{manifest.totalLrs ?? manifest.shipmentIds?.length ?? 0}</td><td className="numeric">{manifest.totalPackages ?? 0}</td><td className="numeric">{Number(manifest.totalWeightKg || 0).toLocaleString('en-IN')}</td>
        </tr>)}{!(trip.manifestIds || []).length && <tr><td colSpan={6}>No manifests added to this trip.</td></tr>}</tbody>
        <tfoot><tr><td colSpan={3}>Total: {trip.manifestIds?.length || 0} manifests</td><td className="numeric">{trip.totalLrs ?? 0}</td><td className="numeric">{trip.totalPackages ?? 0}</td><td className="numeric">{Number(trip.totalWeightKg || 0).toLocaleString('en-IN')}</td></tr></tfoot>
      </table>
      <footer className="tally-signatures"><div><span>Prepared by</span><b>Signature / Name</b></div><div><span>Driver signature</span><b>Signature / Name</b></div></footer>
    </div></div>
  </Modal>;
}

function TripWorkspace() {
  const { user } = useAuth();
  const refresh = useRefresh();
  const [page, setPage] = useState(1), [open, setOpen] = useState(false), [source, setSource] = useState('VV'), [vendorId, setVendorId] = useState(''), [destination, setDestination] = useState(''), [printTrip, setPrintTrip] = useState(null);
  const query = useQuery({ queryKey: ['middle-mile-trips', page], queryFn: () => middleMileApi.trips.list({ page, limit: 20 }) });
  const manifests = useQuery({ queryKey: ['middle-mile-manifests', 'available'], queryFn: () => allRows(middleMileApi.manifests.list) });
  const vendors = useQuery({ queryKey: ['vendor-options'], queryFn: vendorOptionsApi.list });
  const routes = useQuery({ queryKey: ['master-options', 'ROUTE', 'trip-all'], queryFn: () => allRows((params) => masterOptionsApi.list('ROUTE', params)), enabled: open });
  const available = rows(manifests).filter((row) => row.workflowStatus === 'LOCKED' && !row.tripId);
  const destinations = [...new Set(available.map((row) => row.destination))];
  const create = useMutation({ mutationFn: middleMileApi.trips.create, onSuccess: (result) => { toast.success(`Trip ${result.data.tripNumber} created. Print is available in the register.`); setOpen(false); refresh(); }, onError: (error) => toast.error(errorMessage(error)) });
  const action = useMutation({ mutationFn: (row) => middleMileApi.dispatchTrip(idOf(row)), onSuccess: () => { toast.success('Trip dispatched'); refresh(); }, onError: (error) => toast.error(errorMessage(error)) });
  return <>
    <PageHeader title="Middle Mile Trip Creation" description="Select MV/VV, destination city, trip route and manifest, then enter the seal number."><button className="btn" onClick={() => { setDestination(''); setOpen(true); }}>Create Trip</button></PageHeader>
    <section className="panel">{query.isPending ? <Loadingcrleleton /> : query.isError ? <ErrorState error={errorMessage(query.error)} retry={query.refetch} /> : <DataTable rows={rows(query)} pagination={query.data?.pagination} onPage={setPage} columns={[
      { key: 'tripNumber', label: 'Trip' }, { key: 'destination', label: 'Destination' }, { key: 'vehicleNumber', label: 'Vehicle' }, { key: 'sealNumber', label: 'Seal number' },
      { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
      { key: 'actions', label: 'Actions', render: (row) => <div className="actions"><button className="text-btn" onClick={() => setPrintTrip(row)}>Print Trip</button>{['ADMIN', 'MANAGER'].includes(user.role) && row.status === 'PLANNED' && <button className="text-btn" disabled={action.isPending} onClick={() => action.mutate(row)}>Dispatch</button>}</div> },
    ]} />}</section>
    {open && <Modal title="Create Middle Mile Trip" onClose={() => setOpen(false)}>{manifests.isError || vendors.isError ? <ErrorState error={errorMessage(manifests.error || vendors.error)} retry={() => { manifests.refetch(); vendors.refetch(); }} /> : <form onSubmit={(event) => {
      event.preventDefault(); const form = new FormData(event.currentTarget);
      create.mutate({ vehicleSource: source, destination, routeId: form.get('routeId'), manifestIds: [form.get('manifestId')], sealNumber: form.get('sealNumber'), vendorId: form.get('vendorId') || undefined,
        vehicleNumber: form.get('vehicleNumber'), vehicleType: form.get('vehicleType') || undefined, vehicleCapacityKg: form.get('vehicleCapacityKg') || undefined,
        driverName: form.get('driverName'), driverMobile: form.get('driverMobile') || undefined, departureDate: form.get('departureDate'), freightAmount: form.get('freightAmount') || 0 });
    }}><div className="form-grid">
      <TripVehicleFields vendors={rows(vendors)} source={source} vendorId={vendorId} onSourceChange={setSource} onVendorChange={setVendorId} />
      <label>Trip cost {source === 'MV' ? '(required for MV)' : ''}<input name="freightAmount" type="number" min={source === 'MV' ? '0.01' : '0'} step="0.01" required={source === 'MV'} /></label>
      <label>Destination<select required value={destination} onChange={(event) => setDestination(event.target.value)}><option value="">Select destination</option>{destinations.map((row) => <option key={row} value={row}>{row}</option>)}</select></label>
      <label>Route *<select name="routeId" key={destination + '-route'} required><option value="">Select trip route</option>{rows(routes).filter((route) => route.destination?.trim().toLowerCase() === destination.trim().toLowerCase()).map((route) => <option key={idOf(route)} value={idOf(route)}>{route.name} ({route.origin} to {route.destination})</option>)}</select></label>
      {routes.isError && <ErrorState error={errorMessage(routes.error)} retry={routes.refetch} />}
      <label>Manifest number<select name="manifestId" key={destination} required><option value="">Select manifest</option>{available.filter((row) => row.destination === destination).map((row) => <option key={idOf(row)} value={idOf(row)}>{row.manifestNumber} - {row.totalLrs} LRs / {Number(row.totalWeightKg || 0).toLocaleString('en-IN')} kg</option>)}</select></label>
      <label>Seal number<input name="sealNumber" required maxLength={80} /></label><label>Departure date<input name="departureDate" type="datetime-local" required /></label>
    </div><div className="modal-footer"><button className="btn" disabled={create.isPending || manifests.isPending || vendors.isPending || routes.isPending || routes.isError}>{create.isPending ? 'Creating...' : 'Create Trip'}</button></div></form>}</Modal>}
    {printTrip && <TripDocument trip={printTrip} onClose={() => setPrintTrip(null)} />}
  </>;
}

export default function MiddleMilePage() {
  const path = useLocation().pathname.split('/').at(-1);
  if (path === 'segregations') return <RouteSortingWorkspace />;
  if (path === 'loading-tallies') return <TallyWorkspace />;
  if (path === 'manifests') return <ManifestWorkspace />;
  return <TripWorkspace />;
}
