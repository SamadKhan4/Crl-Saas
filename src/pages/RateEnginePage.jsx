import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { rateCardsApi } from '../api/services';
import { errorMessage } from '../api/client';
import Lookup from '../components/forms/Lookup';
import { DataTable, ErrorState, Loadingcrleleton, Modal, PageHeader, StatusBadge } from '../components/common/UI';
import { label } from '../lib/workflow';

const bases = ['PER_BOX', 'PER_KG', 'PER_CHARGED_KG', 'PER_TON', 'PER_CFT', 'PER_CBM', 'PER_KM', 'PER_VEHICLE', 'PER_TRIP', 'PER_LR', 'PER_SHIPMENT', 'FIXED', 'SLAB', 'PERCENTAGE'];
const services = ['FM', 'MM', 'LM', 'PTL', 'FTL', 'PICKUP', 'DELIVERY', 'HUB_TRANSFER'];
export default function RateEnginePage() {
  const client = useQueryClient();
  const [open, setOpen] = useState(false), [page, setPage] = useState(1), [partyType, setPartyType] = useState('CLIENT'), [partyId, setPartyId] = useState('');
  const query = useQuery({ queryKey: ['rate-cards', page], queryFn: () => rateCardsApi.list({ page, limit: 20 }) });
  const mutation = useMutation({ mutationFn: rateCardsApi.create, onSuccess: () => { toast.success('Rate card saved'); setOpen(false); client.invalidateQueries({ queryKey: ['rate-cards'] }); }, onError: (error) => toast.error(errorMessage(error)) });
  const save = (event) => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    mutation.mutate({ code: form.get('code'), partyType, ...(partyType === 'CLIENT' ? { customerId: partyId } : { vendorId: partyId }), service: form.get('service'), origin: form.get('origin') || undefined, destination: form.get('destination') || undefined, pincode: form.get('pincode') || undefined, zone: form.get('zone') || undefined, vehicleType: form.get('vehicleType') || undefined, basis: form.get('basis'), rate: Number(form.get('rate')), minimumCharge: Number(form.get('minimumCharge') || 0), minimumWeightKg: Number(form.get('minimumWeightKg') || 0), gstRate: Number(form.get('gstRate') || 0), tdsRate: Number(form.get('tdsRate') || 0), effectiveFrom: form.get('effectiveFrom'), effectiveTo: form.get('effectiveTo') || undefined, status: 'ACTIVE', slabs: [], charges: [] });
  };
  return <><PageHeader title="Rate Engine" description="Effective-date pricing by client/vendor, service, lane, PIN, zone, vehicle and charge basis."><button className="btn" onClick={() => setOpen(true)}><Plus size={17} /> Add rate</button></PageHeader>
    <section className="panel">{query.isPending ? <Loadingcrleleton /> : query.isError ? <ErrorState error={errorMessage(query.error)} retry={query.refetch} /> : <DataTable rows={query.data.data} pagination={query.data.pagination} onPage={setPage} columns={[{ key: 'code', label: 'Code' }, { key: 'partyType', label: 'Party' }, { key: 'party', label: 'Name', render: (r) => r.customerId?.companyName || r.customerId?.name || r.vendorId?.name }, { key: 'service', label: 'Service' }, { key: 'lane', label: 'Lane', render: (r) => `${r.origin || 'Any'} → ${r.destination || 'Any'}` }, { key: 'basis', label: 'Basis', render: (r) => label(r.basis) }, { key: 'rate', label: 'Rate' }, { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> }]} />}</section>
    {open && <Modal title="Add rate card" onClose={() => setOpen(false)}><form onSubmit={save}><div className="form-grid"><label>Party type<select value={partyType} onChange={(e) => { setPartyType(e.target.value); setPartyId(''); }}><option>CLIENT</option><option>VENDOR</option></select></label><Lookup resource={partyType === 'CLIENT' ? 'customers' : 'vendors'} label={partyType === 'CLIENT' ? 'Client' : 'Vendor'} value={partyId} onChange={setPartyId} /><label>Rate code<input name="code" required /></label><label>Service<select name="service">{services.map((v) => <option key={v}>{v}</option>)}</select></label><label>Origin<input name="origin" /></label><label>Destination<input name="destination" /></label><label>Pincode<input name="pincode" pattern="\d{6}" /></label><label>Zone<input name="zone" /></label><label>Vehicle type<input name="vehicleType" /></label><label>Basis<select name="basis">{bases.filter((v) => v !== 'SLAB').map((v) => <option key={v}>{v}</option>)}</select></label><label>Rate<input name="rate" type="number" min="0" step="0.01" required /></label><label>Minimum charge<input name="minimumCharge" type="number" min="0" /></label><label>Minimum weight (kg)<input name="minimumWeightKg" type="number" min="0" /></label><label>GST %<input name="gstRate" type="number" min="0" max="100" /></label><label>TDS %<input name="tdsRate" type="number" min="0" max="100" /></label><label>Effective from<input name="effectiveFrom" type="date" required /></label><label>Effective to<input name="effectiveTo" type="date" /></label></div><div className="modal-footer"><button type="button" className="btn secondary" onClick={() => setOpen(false)}>Cancel</button><button className="btn" disabled={mutation.isPending || !partyId}>Save rate</button></div></form></Modal>}
  </>;
}
