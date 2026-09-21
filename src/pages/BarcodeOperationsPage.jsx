import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ScanLine } from 'lucide-react';
import { toast } from 'sonner';
import JsBarcode from 'jsbarcode';
import { packageBarcodesApi } from '../api/services';
import { errorMessage } from '../api/client';
import { DataTable, ErrorState, Loadingcrleleton, Modal, PageHeader, StatusBadge } from '../components/common/UI';

const actions = ['PICKUP', 'HUB_INWARD', 'SORTED', 'LOADED', 'UNLOADED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'DAMAGE', 'SHORT', 'EXCESS', 'HOLD', 'MISROUTE'];
export default function BarcodeOperationsPage() {
  const client = useQueryClient();
  const [search, setSearch] = useState(''), [page, setPage] = useState(1), [selected, setSelected] = useState(null);
  const query = useQuery({ queryKey: ['package-barcodes', search, page], queryFn: () => packageBarcodesApi.list({ search: search || undefined, page, limit: 20 }) });
  const scan = useMutation({ mutationFn: ({ barcode, body }) => packageBarcodesApi.scan(barcode, body), onSuccess: () => { toast.success('Package scan recorded'); setSelected(null); client.invalidateQueries({ queryKey: ['package-barcodes'] }); }, onError: (error) => toast.error(errorMessage(error)) });
  const print = (row) => { const canvas = document.createElement('canvas'); JsBarcode(canvas, row.barcode, { format: 'CODE128', displayValue: true, height: 55 }); const win = window.open('', '_blank', 'noopener,noreferrer'); if (!win) return toast.error('Allow popups to print barcode'); win.document.write(`<title>${row.barcode}</title><div style="font:14px Arial;text-align:center;padding:30px"><h3>${row.lrNumber} · BOX ${row.sequence}/${row.totalPackages}</h3><img src="${canvas.toDataURL()}" onload="print()" /></div>`); win.document.close(); };
  const save = (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); scan.mutate({ barcode: selected.barcode, body: { action: form.get('action'), location: form.get('location'), vehicleNumber: form.get('vehicleNumber') || undefined, routeCode: form.get('routeCode') || undefined, remarks: form.get('remarks') || undefined } }); };
  return <><PageHeader title="Box Barcode & Scanning" description="Every package has a unique Code-128 barcode and complete custody history."><div className="actions"><input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Scan or search barcode / LR" /><ScanLine /></div></PageHeader>
    <section className="panel">{query.isPending ? <Loadingcrleleton /> : query.isError ? <ErrorState error={errorMessage(query.error)} retry={query.refetch} /> : <DataTable rows={query.data.data} pagination={query.data.pagination} onPage={setPage} columns={[{ key: 'barcode', label: 'Barcode' }, { key: 'lrNumber', label: 'LR' }, { key: 'box', label: 'Box', render: (r) => `${r.sequence}/${r.totalPackages}` }, { key: 'currentLocation', label: 'Location' }, { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> }, { key: 'actions', label: 'Actions', render: (r) => <div className="actions"><button className="text-btn" onClick={() => setSelected(r)}>Scan</button><button className="text-btn" onClick={() => print(r)}>Print</button></div> }]} />}</section>
    {selected && <Modal title={`Scan ${selected.barcode}`} onClose={() => setSelected(null)}><form onSubmit={save}><div className="form-grid"><label>Action<select name="action">{actions.map((v) => <option key={v}>{v}</option>)}</select></label><label>Current location<input name="location" required autoFocus /></label><label>Route code<input name="routeCode" /></label><label>Vehicle number<input name="vehicleNumber" /></label><label className="full-span">Remarks<textarea name="remarks" /></label></div><div className="modal-footer"><button type="button" className="btn secondary" onClick={() => setSelected(null)}>Cancel</button><button className="btn" disabled={scan.isPending}>Save scan</button></div></form></Modal>}
  </>;
}
