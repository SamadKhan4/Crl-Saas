import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Truck, UserRoundCheck } from 'lucide-react';
import { toast } from 'sonner';
import { pickupRequestsApi, vendorsApi } from '../api/services';
import { errorMessage } from '../api/client';
import { useAuth } from '../features/auth/AuthContext';
import { idOf } from '../lib/workflow';
import {
  DataTable,
  ErrorState,
  Loadingcrleleton,
  Modal,
  PageHeader,
  StatCard,
} from '../components/common/UI';

const emptyAssignment = {
  sourceType: 'VENDOR',
  vendorId: '',
  agentName: '',
  vehicleNumber: '',
  vehicleType: '',
  driverName: '',
  driverMobile: '',
  remarks: '',
};

export default function AgentAlignmentPage() {
  const { user } = useAuth();
  const base = `/${user.role.toLowerCase()}`;
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState(null);
  const [assignment, setAssignment] = useState(emptyAssignment);
  const requests = useQuery({
    queryKey: ['pickup-requests', 'agent-alignment'],
    queryFn: () => pickupRequestsApi.list({ status: 'PENDING', limit: 100 }),
  });
  const vendors = useQuery({
    queryKey: ['vendors', 'pickup-agents'],
    queryFn: () => vendorsApi.list({ status: 'ACTIVE', limit: 100 }),
  });
  const vendorRows = vendors.data?.data || [];
  const selectedVendor = vendorRows.find(
    (vendor) => String(vendor.id || vendor._id) === assignment.vendorId,
  );
  const vehicles = (selectedVendor?.vehicles || []).filter((vehicle) => vehicle.status !== 'INACTIVE');
  const requestRows = requests.data?.data || [];
  const counts = {
    pending: requestRows.length,
    assigned: requestRows.filter((request) => request.agentAssignment).length,
    unassigned: requestRows.filter((request) => !request.agentAssignment).length,
  };
  const save = useMutation({
    mutationFn: ({ id, body }) => pickupRequestsApi.assignAgent(id, body),
    onSuccess: () => {
      toast.success('Vendor, vehicle and driver assigned');
      setSelected(null);
      setAssignment(emptyAssignment);
      queryClient.invalidateQueries({ queryKey: ['pickup-requests'] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const setField = (name, value) => setAssignment((current) => ({ ...current, [name]: value }));
  const chooseVendor = (vendorId) => {
    const vendor = vendorRows.find((row) => String(row.id || row._id) === vendorId);
    const vehicle = vendor?.vehicles?.find((item) => item.status !== 'INACTIVE');
    setAssignment((current) => ({
      ...current,
      vendorId,
      agentName: vendor?.contactPerson || vendor?.name || '',
      vehicleNumber: vehicle?.vehicleNumber || '',
      vehicleType: vehicle?.vehicleType || '',
      driverName: vehicle?.driverName || '',
      driverMobile: vehicle?.driverMobile || '',
    }));
  };
  const chooseSource = (sourceType) => {
    setAssignment({ ...emptyAssignment, sourceType });
  };
  const chooseVehicle = (vehicleNumber) => {
    const vehicle = vehicles.find((item) => item.vehicleNumber === vehicleNumber);
    setAssignment((current) => ({
      ...current,
      vehicleNumber,
      vehicleType: vehicle?.vehicleType || current.vehicleType,
      driverName: vehicle?.driverName || current.driverName,
      driverMobile: vehicle?.driverMobile || current.driverMobile,
    }));
  };
  const openAssignment = (request) => {
    const existing = request.agentAssignment;
    setSelected(request);
    setAssignment(
      existing
        ? {
            sourceType: existing.sourceType || (existing.vendorId ? 'VENDOR' : 'MARKET'),
            vendorId: existing.vendorId
              ? String(existing.vendorId?.id || existing.vendorId?._id || existing.vendorId)
              : '',
            agentName: existing.agentName || '',
            vehicleNumber: existing.vehicleNumber || '',
            vehicleType: existing.vehicleType || '',
            driverName: existing.driverName || '',
            driverMobile: existing.driverMobile || '',
            remarks: existing.remarks || '',
          }
        : emptyAssignment,
    );
  };
  const submit = (event) => {
    event.preventDefault();
    save.mutate({
      id: selected.id || selected._id,
      body: Object.fromEntries(
        Object.entries(assignment).filter(([, value]) => String(value).trim() !== ''),
      ),
    });
  };

  return (
    <>
      <PageHeader
        title="Agent Alignment"
        description="Assign a vendor or market vehicle and driver against each pending PUR."
      />
      <div className="stats-grid agent-summary">
        <StatCard label="Pending PUR" value={counts.pending} icon={Truck} />
        <StatCard label="Agent assigned" value={counts.assigned} icon={UserRoundCheck} />
        <StatCard label="Awaiting assignment" value={counts.unassigned} />
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Pending pickup requests</h2>
            <p>Use Vendor Master vehicles or enter a market vehicle and driver manually.</p>
          </div>
        </div>
        {requests.isPending || vendors.isPending ? (
          <Loadingcrleleton />
        ) : requests.isError || vendors.isError ? (
          <ErrorState
            error={errorMessage(requests.error || vendors.error)}
            retry={() => {
              requests.refetch();
              vendors.refetch();
            }}
          />
        ) : (
          <DataTable
            rows={requestRows}
            empty="No pending pickup requests"
            columns={[
              { key: 'pickupRequestNumber', label: 'PUR number' },
              { key: 'shipper', label: 'Shipper', render: (row) => row.shipper?.companyName },
              {
                key: 'route',
                label: 'Route',
                render: (row) => `${row.shipper?.city || '—'} → ${row.recipient?.city || '—'}`,
              },
              { key: 'serviceType', label: 'Service' },
              {
                key: 'vendor',
                label: 'Vehicle source / Agent',
                render: (row) =>
                  row.agentAssignment
                    ? row.agentAssignment.sourceType === 'MARKET'
                      ? `Market · ${row.agentAssignment.agentName}`
                      : row.agentAssignment.vendorId?.name || row.agentAssignment.agentName
                    : 'Not assigned',
              },
              {
                key: 'vehicle',
                label: 'Vehicle / Driver',
                render: (row) =>
                  row.agentAssignment
                    ? `${row.agentAssignment.vehicleNumber} · ${row.agentAssignment.driverName}`
                    : '—',
              },
              {
                key: 'action',
                label: 'Action',
                render: (row) => row.shipmentId ? (
                  <Link className="text-btn" to={`${base}/shipments/${idOf(row.shipmentId)}`}>
                    View LR {row.shipmentId.lrNumber}
                  </Link>
                ) : row.agentAssignment ? (
                  <div className="actions">
                    <button className="text-btn" onClick={() => openAssignment(row)}>Change alignment</button>
                    <Link className="btn" to={`${base}/shipments/create?pickupRequest=${idOf(row)}`}>
                      Create LR
                    </Link>
                  </div>
                ) : (
                  <button className="text-btn" onClick={() => openAssignment(row)}>Align agent</button>
                ),
              },
            ]}
          />
        )}
      </section>
      {selected && (
        <Modal
          title={`Agent alignment · ${selected.pickupRequestNumber}`}
          onClose={() => {
            setSelected(null);
            setAssignment(emptyAssignment);
          }}
        >
          <form onSubmit={submit}>
            <div className="form-grid">
              <label className="full-span">
                Vehicle source *
                <select
                  required
                  value={assignment.sourceType}
                  onChange={(event) => chooseSource(event.target.value)}
                >
                  <option value="VENDOR">Vendor vehicle</option>
                  <option value="MARKET">Market vehicle (manual)</option>
                </select>
              </label>
              {assignment.sourceType === 'VENDOR' && (
                <label className="full-span">
                  Vendor / pickup agent *
                  <select
                    required
                    value={assignment.vendorId}
                    onChange={(event) => chooseVendor(event.target.value)}
                  >
                    <option value="">Select vendor</option>
                    {vendorRows.map((vendor) => (
                      <option key={vendor.id || vendor._id} value={vendor.id || vendor._id}>
                        {vendor.vendorCode} · {vendor.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label>
                {assignment.sourceType === 'MARKET' ? 'Market agent / owner name *' : 'Agent/contact name *'}
                <input
                  required
                  value={assignment.agentName}
                  onChange={(event) => setField('agentName', event.target.value)}
                />
              </label>
              <label>
                Vehicle number *
                <input
                  required
                  list={assignment.sourceType === 'VENDOR' ? 'vendor-vehicles' : undefined}
                  value={assignment.vehicleNumber}
                  onChange={(event) => chooseVehicle(event.target.value.toUpperCase())}
                />
                <datalist id="vendor-vehicles">
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.vehicleNumber} value={vehicle.vehicleNumber} />
                  ))}
                </datalist>
              </label>
              <label>
                Vehicle type
                <input
                  value={assignment.vehicleType}
                  onChange={(event) => setField('vehicleType', event.target.value)}
                />
              </label>
              <label>
                Driver name *
                <input
                  required
                  value={assignment.driverName}
                  onChange={(event) => setField('driverName', event.target.value)}
                />
              </label>
              <label>
                Driver mobile *
                <input
                  required
                  type="tel"
                  inputMode="numeric"
                  value={assignment.driverMobile}
                  onChange={(event) => setField('driverMobile', event.target.value)}
                />
              </label>
              <label className="full-span">
                Remarks
                <textarea
                  rows="3"
                  maxLength="500"
                  value={assignment.remarks}
                  onChange={(event) => setField('remarks', event.target.value)}
                />
              </label>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn secondary" onClick={() => setSelected(null)}>
                Cancel
              </button>
              <button className="btn" disabled={save.isPending}>
                {save.isPending ? 'Saving…' : 'Save alignment'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
