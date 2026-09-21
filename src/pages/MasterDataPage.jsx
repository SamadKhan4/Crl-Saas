import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { masterDataApi } from '../api/services';
import { errorMessage } from '../api/client';
import { DataTable, ErrorState, Loadingcrleleton, Modal, PageHeader, StatusBadge } from '../components/common/UI';

const configs = {
  company: { type: 'COMPANY', title: 'Company Master', description: 'Legal identity, bank, registrations and document-number series.', fields: [['code', 'Company code'], ['name', 'Company / legal name'], ['address', 'Registered address'], ['city', 'City'], ['state', 'State'], ['pincode', 'Pincode'], ['contact.person', 'Contact person'], ['contact.mobile', 'Mobile'], ['contact.email', 'Email', 'email'], ['registration.gstin', 'GSTIN'], ['registration.pan', 'PAN'], ['registration.tan', 'TAN'], ['registration.cin', 'CIN'], ['registration.udyam', 'Udyam number'], ['bank.bankName', 'Bank name'], ['bank.accountName', 'Account name'], ['bank.accountNumber', 'Account number'], ['bank.ifsc', 'IFSC'], ['bank.upi', 'UPI'], ['documentSeries.lr', 'LR series'], ['documentSeries.invoice', 'Invoice series'], ['documentSeries.receipt', 'Receipt series'], ['documentSeries.manifest', 'Manifest series'], ['documentSeries.trip', 'Trip series']] },
  locations: { type: 'LOCATION', title: 'Location Master', description: 'Serviceable PIN codes, zones and ODA controls.', fields: [['code', 'Location code'], ['name', 'Area / location'], ['city', 'City'], ['state', 'State'], ['pincode', 'Pincode'], ['zone', 'Zone'], ['latitude', 'Latitude', 'number'], ['longitude', 'Longitude', 'number'], ['flags.serviceable', 'Serviceable', 'checkbox'], ['flags.oda', 'ODA location', 'checkbox']] },
  routes: { type: 'ROUTE', title: 'Route Master', description: 'Distance, transit time, hubs and operational rates.', fields: [['code', 'Route code'], ['name', 'Route name'], ['origin', 'Origin'], ['destination', 'Destination'], ['distanceKm', 'Distance (km)', 'number'], ['transitDays', 'Transit days', 'number'], ['vehicleType', 'Preferred vehicle'], ['financial.toll', 'Toll', 'number'], ['financial.fmRate', 'FM rate', 'number'], ['financial.mmRate', 'MM rate', 'number'], ['financial.lmRate', 'LM rate', 'number']] },
  items: { type: 'ITEM', title: 'Item / Goods Master', description: 'HSN and handling controls for transported goods.', fields: [['code', 'Item code'], ['name', 'Item name'], ['category', 'Category'], ['hsn', 'HSN'], ['standardWeight', 'Standard weight', 'number'], ['flags.fragile', 'Fragile', 'checkbox'], ['flags.hazardous', 'Hazardous', 'checkbox'], ['flags.perishable', 'Perishable', 'checkbox'], ['flags.temperatureControlled', 'Temperature controlled', 'checkbox']] },
  packages: { type: 'PACKAGE', title: 'Package Master', description: 'Standard package types, dimensions, weight and CFT.', fields: [['code', 'Package code'], ['name', 'Package name'], ['packageType', 'Type'], ['length', 'Length', 'number'], ['width', 'Width', 'number'], ['height', 'Height', 'number'], ['standardWeight', 'Weight', 'number'], ['cft', 'CFT', 'number']] },
};

const setPath = (target, path, value) => {
  const parts = path.split('.');
  let cursor = target;
  parts.slice(0, -1).forEach((part) => { cursor[part] ||= {}; cursor = cursor[part]; });
  cursor[parts.at(-1)] = value;
};

export default function MasterDataPage() {
  const key = useLocation().pathname.split('/').at(-1);
  const config = configs[key] || configs.locations;
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const query = useQuery({ queryKey: ['master-data', config.type, page], queryFn: () => masterDataApi.list({ type: config.type, page, limit: 20 }) });
  const mutation = useMutation({
    mutationFn: (body) => masterDataApi.create(body),
    onSuccess: () => { toast.success('Master record saved'); setOpen(false); client.invalidateQueries({ queryKey: ['master-data', config.type] }); },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const columns = useMemo(() => [
    { key: 'code', label: 'Code' }, { key: 'name', label: 'Name' },
    ...(config.type === 'ROUTE' ? [{ key: 'lane', label: 'Lane', render: (row) => `${row.origin} → ${row.destination}` }] : []),
    ...(config.type === 'LOCATION' ? [{ key: 'pincode', label: 'Pincode' }, { key: 'zone', label: 'Zone' }] : []),
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
  ], [config.type]);
  const save = (event) => {
    event.preventDefault();
    const data = { type: config.type, status: 'ACTIVE' };
    for (const [name, , type] of config.fields) {
      const input = event.currentTarget.elements.namedItem(name);
      if (!input) continue;
      const value = type === 'checkbox' ? input.checked : input.value;
      if (value !== '') setPath(data, name, type === 'number' ? Number(value) : value);
    }
    mutation.mutate(data);
  };
  return <>
    <PageHeader title={config.title} description={config.description}>
      <button className="btn secondary" onClick={() => query.refetch()}><RefreshCw size={16} /> Refresh</button>
      <button className="btn" onClick={() => setOpen(true)}><Plus size={17} /> Add record</button>
    </PageHeader>
    <section className="panel">{query.isPending ? <Loadingcrleleton /> : query.isError ? <ErrorState error={errorMessage(query.error)} retry={query.refetch} /> : <DataTable rows={query.data.data} columns={columns} pagination={query.data.pagination} onPage={setPage} />}</section>
    {open && <Modal title={`Add ${config.title}`} onClose={() => setOpen(false)}>
      <form onSubmit={save}>
        <div className="form-grid">{config.fields.map(([name, label, type = 'text']) => <label key={name}>{type === 'checkbox' ? <><input name={name} type="checkbox" defaultChecked /> {label}</> : <>{label}<input name={name} type={type} required={['code', 'name', 'origin', 'destination', 'pincode', 'vehicleNumber'].includes(name)} min={type === 'number' ? 0 : undefined} /></>}</label>)}</div>
        <div className="modal-footer"><button type="button" className="btn secondary" onClick={() => setOpen(false)}>Cancel</button><button className="btn" disabled={mutation.isPending}>{mutation.isPending ? 'Saving…' : 'Save record'}</button></div>
      </form>
    </Modal>}
  </>;
}
