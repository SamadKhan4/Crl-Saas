import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { pickupRunSheetsApi, usersApi } from '../api/services';
import { errorMessage } from '../api/client';
import { useAuth } from '../features/auth/AuthContext';
import { idOf, label } from '../lib/workflow';
import { DataTable, ErrorState, FormField, Loadingcrleleton, Modal, PageHeader } from '../components/common/UI';

const today = () => new Date().toISOString().slice(0, 10);
const initialForm = { vendorCategory: 'TRANSPORTER', rateSource: 'MASTER', vendorId: '', fieldExecutiveId: '', vehicleNumber: '', vehicleType: '', pickupDate: today(), marketAmount: '', remarks: '' };
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
  const [lrEntries, setLrEntries] = useState({});
  const options = useQuery({ queryKey: ['pickup-run-sheets', 'options'], queryFn: pickupRunSheetsApi.options });
  const vendors = options.data?.data?.vendors || [];
  const marketVehicles = options.data?.data?.marketVehicles || [];
  const fieldExecutives = options.data?.data?.fieldExecutives || [];
  const selectedVendor = vendors.find((vendor) => idOf(vendor) === form.vendorId);
  const selectedMarketVehicle = marketVehicles.find((vehicle) => `market:${idOf(vehicle.pickupRequestId)}` === form.vendorId);
  const vehicles = selectedMarketVehicle ? [selectedMarketVehicle] : (selectedVendor?.vehicles || []).filter((vehicle) => vehicle.status !== 'INACTIVE');
  const vendorLrs = (options.data?.data?.pickups || []).filter((pickup) => selectedMarketVehicle
    ? idOf(pickup) === idOf(selectedMarketVehicle.pickupRequestId)
    : Boolean(form.vendorId) && pickup.agentAssignment?.sourceType === 'VENDOR' && idOf(pickup.agentAssignment.vendorId) === form.vendorId);
  const includedLrs = vendorLrs.filter((pickup) => lrEntries[idOf(pickup)]?.included !== false);
  const updateEntry = (pickup, changes) => setLrEntries((current) => ({ ...current, [idOf(pickup)]: { ...current[idOf(pickup)], ...changes } }));
  const setField = (name, value) => setForm((current) => ({ ...current, [name]: value }));
  const chooseVendor = (vendorId) => {
    const vendor = vendors.find((row) => idOf(row) === vendorId);
    const marketVehicle = marketVehicles.find((row) => `market:${idOf(row.pickupRequestId)}` === vendorId);
    const vehicle = marketVehicle || vendor?.vehicles?.find((row) => row.status !== 'INACTIVE');
    setLrEntries({});
    setForm((current) => ({ ...current, vendorId, rateSource: marketVehicle ? 'MARKET' : 'MASTER', vehicleNumber: vehicle?.vehicleNumber || '', vehicleType: vehicle?.vehicleType || '' }));
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
      pickups: includedLrs.map((pickup) => ({ pickupRequestId: idOf(pickup) })),
      vendorId: selectedMarketVehicle ? undefined : form.vendorId,
      marketPickupRequestId: selectedMarketVehicle ? idOf(selectedMarketVehicle.pickupRequestId) : undefined,
      ...(form.rateSource === 'MARKET' ? { marketAmount: form.marketAmount } : { marketAmount: undefined }),
      remarks: form.remarks || undefined,
    }),
    onSuccess: (result) => {
      toast.success(`PRS ${result.data.prsNumber} created and dispatched with ${includedLrs.length} LRs.`);
      setForm(initialForm);
      setLrEntries({});
      cache.invalidateQueries({ queryKey: ['pickup-requests'] });
      setError('');
      cache.invalidateQueries({ queryKey: ['pickup-run-sheets'] });
      navigate(`${base}/pickup-run-sheets/${idOf(result.data)}`);
    },
    onError: (reason) => setError(errorMessage(reason)),
  });
  const submit = (event) => {
    event.preventDefault();
    setError('');
    if (!includedLrs.length) return setError('Select at least one available LR.');
    create.mutate();
  };
  if (options.isPending) return <Loadingcrleleton />;
  if (options.isError)
    return <ErrorState error={errorMessage(options.error)} retry={options.refetch} />;

  return (
    <>
      <PageHeader title="Dispatch Create · PRS" description="Select a vendor, review its LRs and submit to create PRS." />
      <form className="panel form-section" onSubmit={submit}>
        <div className="section-title"><span>01</span><div><h2>Create vendor dispatch sheet</h2><p>Vendor, rate, FE and vehicle come from their respective masters.</p></div></div>
        <div className="form-grid">
          <label><span>Vendor type *</span><select value={form.vendorCategory} onChange={(event) => setField('vendorCategory', event.target.value)}><option value="TRANSPORTER">Transporter</option><option value="BP_KG">BP (KG)</option></select></label>
          <label><span>Rate source *</span><select disabled={Boolean(selectedMarketVehicle)} value={form.rateSource} onChange={(event) => setField('rateSource', event.target.value)}><option value="MASTER">Vendor Master agreed rate</option><option value="MARKET">Market rate</option></select></label>
          <label><span>Vendor / market owner *</span><select required value={form.vendorId} onChange={(event) => chooseVendor(event.target.value)}><option value="">Select vendor or market vehicle</option><optgroup label="Vendor Master">{vendors.map((vendor) => <option key={idOf(vendor)} value={idOf(vendor)}>{vendor.vendorCode} · {vendor.name}</option>)}</optgroup><optgroup label="Market vehicles">{marketVehicles.map((vehicle) => <option key={idOf(vehicle.pickupRequestId)} value={`market:${idOf(vehicle.pickupRequestId)}`}>{vehicle.agentName} · {vehicle.vehicleNumber} · {vehicle.vehicleType || 'Vehicle'} · {vehicle.lrNumber || 'LR pending'}</option>)}</optgroup></select></label>
          <div className="field"><label htmlFor="prsFieldExecutive">Field Executive *</label><div className="fe-select-row"><select id="prsFieldExecutive" required value={form.fieldExecutiveId} onChange={(event) => setField('fieldExecutiveId', event.target.value)}><option value="">Select FE</option>{fieldExecutives.map((employee) => <option key={idOf(employee)} value={idOf(employee)}>{employee.employeeCode} · {employee.name} · {employee.mobile || 'Mobile missing'}</option>)}</select>{['ADMIN', 'MANAGER'].includes(user.role) && <button type="button" className="icon-btn fe-add-button" aria-label="Create field executive" title="Create field executive" onClick={openFeModal}><Plus size={18} /></button>}</div></div>
          <label><span>Vehicle number *</span><select required value={form.vehicleNumber} onChange={(event) => chooseVehicle(event.target.value)}><option value="">Select vendor vehicle</option>{vehicles.map((vehicle) => <option key={vehicle.vehicleNumber} value={vehicle.vehicleNumber}>{vehicle.vehicleNumber} · {vehicle.vehicleType || 'Vehicle'}</option>)}</select></label>
          <FormField label="Vehicle type" required readOnly value={form.vehicleType} />
          <FormField label="Pickup date" type="date" required value={form.pickupDate} onChange={(event) => setField('pickupDate', event.target.value)} />
          {form.rateSource === 'MARKET' ? (
            <FormField label="Market amount (rate review required)" type="number" min="0.01" step="0.01" required value={form.marketAmount} onChange={(event) => setField('marketAmount', event.target.value)} />
          ) : (
            <div className="field"><label>Master agreed rate</label><div className="master-rate-preview"><strong>₹ {Number(selectedVendor?.commercial?.rate || 0).toLocaleString('en-IN')}</strong><small>{label(form.vendorCategory === 'BP_KG' ? 'PER_KG' : selectedVendor?.commercial?.rateBasis)}</small></div></div>
          )}
          <div className="field full-span"><label htmlFor="prsRemarks">Remarks</label><textarea id="prsRemarks" rows="3" maxLength={500} value={form.remarks} onChange={(event) => setField('remarks', event.target.value)} /></div>
        </div>
        <div className="panel-heading"><div><h2>Vendor LRs</h2><p>{form.vendorId ? `${includedLrs.length} LRs included. LRs already assigned to a PRS are excluded.` : 'Select a vendor to see available LRs.'}</p></div></div>
        <DataTable rows={vendorLrs} empty="No available LRs for this vendor" columns={[
          { key: 'include', label: 'Include', render: (pickup) => <input type="checkbox" aria-label={`Include ${pickup.shipmentId?.lrNumber}`} checked={lrEntries[idOf(pickup)]?.included !== false} onChange={(event) => updateEntry(pickup, { included: event.target.checked })} /> },
          { key: 'lr', label: 'LR number', render: (pickup) => pickup.shipmentId?.lrNumber },
          { key: 'client', label: 'Client', render: (pickup) => pickup.shipmentId?.customerId?.companyName || pickup.shipmentId?.customerId?.name || pickup.shipmentId?.senderName || pickup.shipper?.companyName },
          { key: 'destination', label: 'Destination', render: (pickup) => pickup.shipmentId?.lrDetails?.to || pickup.recipient?.city },
          { key: 'route', label: 'Route', render: (pickup) => pickup.agentAssignment?.route || `${pickup.shipper?.city || ''} - ${pickup.recipient?.city || ''}` },
          { key: 'load', label: 'Load', render: (pickup) => `${pickup.shipmentId?.packageCount ?? pickup.totalBoxes} boxes / ${pickup.shipmentId?.weightKg ?? pickup.totalWeightKg} kg` },
          { key: 'payment', label: 'Payment type', render: (pickup) => label(pickup.shipmentId?.lrDetails?.paymentMode) || 'Not entered' },
          { key: 'amount', label: 'LR amount (?)', render: (pickup) => pickup.shipmentId?.lrDetails?.totalAmount != null ? Number(pickup.shipmentId.lrDetails.totalAmount).toLocaleString('en-IN') : 'Not entered' },
        ]} />
        {error && <p className="field-error" role="alert">{error}</p>}
        <div className="form-actions"><span>Total LR amount: ? {includedLrs.reduce((sum, pickup) => sum + Number(pickup.shipmentId?.lrDetails?.totalAmount || 0), 0).toLocaleString('en-IN')}. Selected LRs will be dispatched on creation.</span><button className="btn" disabled={create.isPending || !includedLrs.length}><Plus size={16} /> {create.isPending ? 'Creating sheet…' : 'Create PRS'}</button></div>
      </form>
      {feModalOpen && (
        <Modal title="Add Field Executive" onClose={() => !createFe.isPending && setFeModalOpen(false)}>
          <form onSubmit={(event) => { event.preventDefault(); setFeError(''); createFe.mutate(); }}>
            <p>Create the FE here. After saving, the new FE will be selected in this PRS.</p>
            <div className="form-grid">
              <FormField label="FE name" required minLength={2} maxLength={100} value={feForm.name} onChange={(event) => setFeForm((current) => ({ ...current, name: event.target.value }))} />
              <FormField label="Mobile number" required inputMode="numeric" pattern="[0-9]{10,15}" value={feForm.mobile} onChange={(event) => setFeForm((current) => ({ ...current, mobile: event.target.value }))} />
              <FormField label="Login email" type="email" required value={feForm.email} onChange={(event) => setFeForm((current) => ({ ...current, email: event.target.value }))} />

              <FormField label="Initial password" type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={feForm.password} onChange={(event) => setFeForm((current) => ({ ...current, password: event.target.value }))} />
            </div>
            {feError && <p className="field-error" role="alert">{feError}</p>}
            <div className="modal-footer"><button type="button" className="btn secondary" disabled={createFe.isPending} onClick={() => setFeModalOpen(false)}>Cancel</button><button className="btn" disabled={createFe.isPending}><Plus size={16} /> {createFe.isPending ? 'Creating FE…' : 'Create & Select FE'}</button></div>
          </form>
        </Modal>
      )}
    </>
  );
}
