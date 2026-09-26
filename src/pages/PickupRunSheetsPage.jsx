import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { ClipboardList, Eye, Plus, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { branchesApi, pickupRunSheetsApi, usersApi } from '../api/services';
import { errorMessage } from '../api/client';
import { useAuth } from '../features/auth/AuthContext';
import { date, idOf, label } from '../lib/workflow';
import { DataTable, ErrorState, FormField, Loadingcrleleton, Modal, PageHeader, StatCard, StatusBadge } from '../components/common/UI';

const today = () => new Date().toISOString().slice(0, 10);
const initialForm = { vendorCategory: 'TRANSPORTER', rateSource: 'MASTER', vendorId: '', fieldExecutiveId: '', vehicleNumber: '', vehicleType: '', pickupDate: today(), route: '', marketAmount: '', remarks: '' };
const initialFeForm = { name: '', mobile: '', email: '', branchId: '', password: '' };

export default function PickupRunSheetsPage() {
  const { user } = useAuth();
  const base = `/${user.role.toLowerCase()}`;
  const navigate = useNavigate();
  const cache = useQueryClient();
  const [form, setForm] = useState(initialForm);
  const [feForm, setFeForm] = useState(initialFeForm);
  const [feModalOpen, setFeModalOpen] = useState(false);
  const [feError, setFeError] = useState('');
  const [error, setError] = useState('');
  const options = useQuery({ queryKey: ['pickup-run-sheets', 'options'], queryFn: pickupRunSheetsApi.options });
  const runSheets = useQuery({ queryKey: ['pickup-run-sheets'], queryFn: () => pickupRunSheetsApi.list({ limit: 100, sortBy: 'createdAt', sortOrder: 'desc' }) });
  const branches = useQuery({
    queryKey: ['branches', 'prs-fe-options'],
    queryFn: () => branchesApi.list({ limit: 100, status: 'ACTIVE', sortBy: 'name', sortOrder: 'asc' }),
    enabled: feModalOpen && user.role === 'ADMIN',
  });
  const vendors = options.data?.data?.vendors || [];
  const fieldExecutives = options.data?.data?.fieldExecutives || [];
  const selectedVendor = vendors.find((vendor) => idOf(vendor) === form.vendorId);
  const vehicles = (selectedVendor?.vehicles || []).filter((vehicle) => vehicle.status !== 'INACTIVE');
  const setField = (name, value) => setForm((current) => ({ ...current, [name]: value }));
  const chooseVendor = (vendorId) => {
    const vendor = vendors.find((row) => idOf(row) === vendorId);
    const vehicle = vendor?.vehicles?.find((row) => row.status !== 'INACTIVE');
    setForm((current) => ({ ...current, vendorId, vehicleNumber: vehicle?.vehicleNumber || '', vehicleType: vehicle?.vehicleType || '' }));
  };
  const chooseVehicle = (vehicleNumber) => {
    const vehicle = vehicles.find((row) => row.vehicleNumber === vehicleNumber);
    setForm((current) => ({ ...current, vehicleNumber, vehicleType: vehicle?.vehicleType || '' }));
  };
  const openFeModal = () => {
    setFeForm({ ...initialFeForm, branchId: idOf(user.branchId) || '' });
    setFeError('');
    setFeModalOpen(true);
  };
  const createFe = useMutation({
    mutationFn: () => usersApi.create(feForm),
    onSuccess: async (result) => {
      await options.refetch();
      setField('fieldExecutiveId', idOf(result.data));
      setFeModalOpen(false);
      setFeForm(initialFeForm);
      setFeError('');
      toast.success(`${result.data.name} added and selected as FE.`);
    },
    onError: (reason) => setFeError(errorMessage(reason)),
  });
  const create = useMutation({
    mutationFn: () => pickupRunSheetsApi.create({
      ...form,
      ...(form.rateSource === 'MARKET' ? { marketAmount: form.marketAmount } : { marketAmount: undefined }),
      remarks: form.remarks || undefined,
    }),
    onSuccess: (result) => {
      toast.success(`Draft PRS ${result.data.prsNumber} created. Add PURs now.`);
      setForm(initialForm);
      setError('');
      cache.invalidateQueries({ queryKey: ['pickup-run-sheets'] });
      navigate(`${base}/pickup-run-sheets/${idOf(result.data)}`);
    },
    onError: (reason) => setError(errorMessage(reason)),
  });
  const submit = (event) => {
    event.preventDefault();
    setError('');
    create.mutate();
  };
  const rows = runSheets.data?.data || [];
  const counts = {
    draft: rows.filter((row) => ['DRAFT', 'READY'].includes(row.status)).length,
    approval: rows.filter((row) => row.approvalStatus === 'PENDING').length,
    dispatched: rows.filter((row) => row.status === 'DISPATCHED').length,
  };

  if (options.isPending || runSheets.isPending) return <Loadingcrleleton />;
  if (options.isError || runSheets.isError)
    return <ErrorState error={errorMessage(options.error || runSheets.error)} retry={() => { options.refetch(); runSheets.refetch(); }} />;

  return (
    <>
      <PageHeader title="Dispatch Create · PRS" description="Create vendor and FE sheet first, add PURs inside it, then dispatch the First Mile." />
      <div className="stats-grid agent-summary">
        <StatCard label="Draft / Ready" value={counts.draft} icon={ClipboardList} />
        <StatCard label="Manager approval" value={counts.approval} />
        <StatCard label="Dispatched" value={counts.dispatched} icon={Truck} />
      </div>
      <form className="panel form-section" onSubmit={submit}>
        <div className="section-title"><span>01</span><div><h2>Create vendor dispatch sheet</h2><p>Vendor, rate, FE and vehicle come from their respective masters.</p></div></div>
        <div className="form-grid">
          <label><span>Vendor type *</span><select value={form.vendorCategory} onChange={(event) => setField('vendorCategory', event.target.value)}><option value="TRANSPORTER">Transporter</option><option value="BP_KG">BP (KG)</option></select></label>
          <label><span>Rate source *</span><select value={form.rateSource} onChange={(event) => setField('rateSource', event.target.value)}><option value="MASTER">Vendor Master agreed rate</option><option value="MARKET">Market rate</option></select></label>
          <label><span>Vendor name / code *</span><select required value={form.vendorId} onChange={(event) => chooseVendor(event.target.value)}><option value="">Select vendor</option>{vendors.map((vendor) => <option key={idOf(vendor)} value={idOf(vendor)}>{vendor.vendorCode} · {vendor.name}</option>)}</select></label>
          <div className="field"><label htmlFor="prsFieldExecutive">Field Executive *</label><div className="fe-select-row"><select id="prsFieldExecutive" required value={form.fieldExecutiveId} onChange={(event) => setField('fieldExecutiveId', event.target.value)}><option value="">Select FE</option>{fieldExecutives.map((employee) => <option key={idOf(employee)} value={idOf(employee)}>{employee.employeeCode} · {employee.name} · {employee.mobile || 'Mobile missing'}</option>)}</select>{['ADMIN', 'MANAGER'].includes(user.role) && <button type="button" className="icon-btn fe-add-button" aria-label="Create field executive" title="Create field executive" onClick={openFeModal}><Plus size={18} /></button>}</div></div>
          <label><span>Vehicle number *</span><select required value={form.vehicleNumber} onChange={(event) => chooseVehicle(event.target.value)}><option value="">Select vendor vehicle</option>{vehicles.map((vehicle) => <option key={vehicle.vehicleNumber} value={vehicle.vehicleNumber}>{vehicle.vehicleNumber} · {vehicle.vehicleType || 'Vehicle'}</option>)}</select></label>
          <FormField label="Vehicle type" required readOnly value={form.vehicleType} />
          <FormField label="Pickup date" type="date" required value={form.pickupDate} onChange={(event) => setField('pickupDate', event.target.value)} />
          <FormField label="Route" required maxLength={250} value={form.route} onChange={(event) => setField('route', event.target.value)} />
          {form.rateSource === 'MARKET' ? (
            <FormField label="Market amount (manager approval required)" type="number" min="0.01" step="0.01" required value={form.marketAmount} onChange={(event) => setField('marketAmount', event.target.value)} />
          ) : (
            <div className="field"><label>Master agreed rate</label><div className="master-rate-preview"><strong>₹ {Number(selectedVendor?.commercial?.rate || 0).toLocaleString('en-IN')}</strong><small>{label(form.vendorCategory === 'BP_KG' ? 'PER_KG' : selectedVendor?.commercial?.rateBasis)}</small></div></div>
          )}
          <div className="field full-span"><label htmlFor="prsRemarks">Remarks</label><textarea id="prsRemarks" rows="3" maxLength={500} value={form.remarks} onChange={(event) => setField('remarks', event.target.value)} /></div>
        </div>
        {error && <p className="field-error" role="alert">{error}</p>}
        <div className="form-actions"><span>Sheet create hone ke baad uske View page me PUR add hoga.</span><button className="btn" disabled={create.isPending}><Plus size={16} /> {create.isPending ? 'Creating sheet…' : 'Create Draft PRS'}</button></div>
      </form>
      <section className="panel">
        <div className="panel-heading"><div><h2>PRS register</h2><p>Draft, approval and dispatched sheets.</p></div></div>
        <DataTable rows={rows} empty="No PRS created yet" columns={[
          { key: 'prsNumber', label: 'PRS number' },
          { key: 'dispatchId', label: 'Dispatch ID', render: (row) => row.dispatchId || 'After dispatch' },
          { key: 'vendorName', label: 'Vendor', render: (row) => `${row.vendorCode} · ${row.vendorName}` },
          { key: 'fieldExecutiveName', label: 'FE' },
          { key: 'vehicleNumber', label: 'Vehicle' },
          { key: 'pickupDate', label: 'Pickup date', render: (row) => date(row.pickupDate) },
          { key: 'pickupCount', label: 'PURs', render: (row) => row.pickupRequestIds?.length || 0 },
          { key: 'approvalStatus', label: 'Rate approval', render: (row) => <StatusBadge status={row.approvalStatus} /> },
          { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
          { key: 'action', label: 'Action', render: (row) => <Link className="text-btn" to={`${base}/pickup-run-sheets/${idOf(row)}`}><Eye size={15} /> View PRS</Link> },
        ]} />
      </section>
      {feModalOpen && (
        <Modal title="Add Field Executive" onClose={() => !createFe.isPending && setFeModalOpen(false)}>
          <form onSubmit={(event) => { event.preventDefault(); setFeError(''); createFe.mutate(); }}>
            <p>Create the FE here. After saving, the new FE will be selected in this PRS.</p>
            <div className="form-grid">
              <FormField label="FE name" required minLength={2} maxLength={100} value={feForm.name} onChange={(event) => setFeForm((current) => ({ ...current, name: event.target.value }))} />
              <FormField label="Mobile number" required inputMode="numeric" pattern="[0-9]{10,15}" value={feForm.mobile} onChange={(event) => setFeForm((current) => ({ ...current, mobile: event.target.value }))} />
              <FormField label="Login email" type="email" required value={feForm.email} onChange={(event) => setFeForm((current) => ({ ...current, email: event.target.value }))} />
              {user.role === 'ADMIN' ? (
                <div className="field"><label htmlFor="feBranch">Branch</label><select id="feBranch" required value={feForm.branchId} onChange={(event) => setFeForm((current) => ({ ...current, branchId: event.target.value }))}><option value="">Select branch</option>{(branches.data?.data || []).map((branch) => <option key={idOf(branch)} value={idOf(branch)}>{branch.branchCode} · {branch.name}</option>)}</select>{branches.isError && <small className="field-error">{errorMessage(branches.error)}</small>}</div>
              ) : (
                <FormField label="Branch" value={user.branchId?.name || user.branchId?.branchCode || 'Your assigned branch'} readOnly />
              )}
              <FormField label="Initial password" type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={feForm.password} onChange={(event) => setFeForm((current) => ({ ...current, password: event.target.value }))} />
            </div>
            {feError && <p className="field-error" role="alert">{feError}</p>}
            <div className="modal-footer"><button type="button" className="btn secondary" disabled={createFe.isPending} onClick={() => setFeModalOpen(false)}>Cancel</button><button className="btn" disabled={createFe.isPending || (user.role === 'ADMIN' && branches.isPending)}><Plus size={16} /> {createFe.isPending ? 'Creating FE…' : 'Create & Select FE'}</button></div>
          </form>
        </Modal>
      )}
    </>
  );
}
