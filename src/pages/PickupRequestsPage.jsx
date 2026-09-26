import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ClipboardList, PackageCheck, Plus, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { pickupRequestsApi } from '../api/services';
import { errorMessage } from '../api/client';
import {
  DataTable,
  ErrorState,
  Loadingcrleleton,
  PageHeader,
  StatCard,
  StatusBadge,
} from '../components/common/UI';
import { date, idOf } from '../lib/workflow';
import { useAuth } from '../features/auth/AuthContext';

const partyFields = {
  shipper: [
    ['companyName', 'Client company name', 'text'],
    ['city', 'City', 'text'],
    ['address', 'From address', 'text'],
    ['pincode', 'PIN code', 'text'],
    ['gstin', 'GSTIN', 'text'],
    ['contactName', 'Contact person name', 'text'],
    ['contactMobile', 'Contact person number', 'tel'],
  ],
  recipient: [
    ['companyName', 'Customer company name', 'text'],
    ['city', 'City', 'text'],
    ['address', 'To address', 'text'],
    ['pincode', 'PIN code', 'text'],
    ['gstin', 'GSTIN', 'text'],
  ],
};

const fieldValue = (form, name) => String(form.get(name) || '').trim();

export default function PickupRequestsPage() {
  const { user } = useAuth();
  const base = `/${user.role.toLowerCase()}`;
  const formRef = useRef(null);
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [serviceType, setServiceType] = useState('FTL');
  const list = useQuery({
    queryKey: ['pickup-requests', page, status],
    queryFn: () => pickupRequestsApi.list({ page, limit: 20, ...(status && { status }) }),
  });
  const summary = useQuery({
    queryKey: ['pickup-requests', 'summary'],
    queryFn: pickupRequestsApi.summary,
  });
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['pickup-requests'] });
  };
  const create = useMutation({
    mutationFn: pickupRequestsApi.create,
    onSuccess: ({ data }) => {
      toast.success(`Pickup request ${data.pickupRequestNumber} generated`);
      formRef.current?.reset();
      setServiceType('FTL');
      refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const submit = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const party = (prefix) =>
      Object.fromEntries(
        partyFields[prefix].map(([name]) => [name, fieldValue(form, `${prefix}.${name}`)]),
      );
    create.mutate({
      shipper: party('shipper'),
      recipient: party('recipient'),
      serviceType,
      ...(serviceType === 'PTL' && { movementType: fieldValue(form, 'movementType') }),
      totalBoxes: fieldValue(form, 'totalBoxes'),
      totalWeightKg: fieldValue(form, 'totalWeightKg'),
    });
  };
  const counts = summary.data?.data;

  return (
    <>
      <PageHeader
        title="Pickup Request"
        description="Generate and track pickup requests before agent alignment and LR entry."
      />
      {summary.isError ? (
        <ErrorState error={errorMessage(summary.error)} retry={summary.refetch} />
      ) : (
        <div className="stats-grid pickup-summary">
          <StatCard label="Total PUR" value={counts?.total} icon={ClipboardList} />
          <StatCard label="Pending" value={counts?.pending} icon={PackageCheck} />
          <StatCard label="Dispatched" value={counts?.dispatched} icon={Truck} />
          <StatCard label="Cancelled" value={counts?.cancelled} />
        </div>
      )}
      <section className="panel pickup-form-panel">
        <div className="panel-heading">
          <div>
            <h2>Generate pickup request</h2>
            <p>A unique PUR number is generated automatically after submission.</p>
          </div>
        </div>
        <form ref={formRef} onSubmit={submit}>
          <div className="pickup-form-section">
            <h3>Shipper Details (Consignor)</h3>
            <div className="form-grid">
              {partyFields.shipper.map(([name, label, type]) => (
                <label key={name} className={name === 'address' ? 'full-span' : undefined}>
                  {label} *
                  <input
                    name={`shipper.${name}`}
                    type={type}
                    required
                    maxLength={name === 'address' ? 500 : 150}
                    inputMode={name === 'pincode' || name === 'contactMobile' ? 'numeric' : undefined}
                    pattern={name === 'pincode' ? '\\d{6}' : undefined}
                  />
                </label>
              ))}
            </div>
          </div>
          <div className="pickup-form-section">
            <h3>Recipient’s Details (Consignee)</h3>
            <div className="form-grid">
              {partyFields.recipient.map(([name, label, type]) => (
                <label key={name} className={name === 'address' ? 'full-span' : undefined}>
                  {label} *
                  <input
                    name={`recipient.${name}`}
                    type={type}
                    required
                    maxLength={name === 'address' ? 500 : 150}
                    inputMode={name === 'pincode' ? 'numeric' : undefined}
                    pattern={name === 'pincode' ? '\\d{6}' : undefined}
                  />
                </label>
              ))}
            </div>
          </div>
          <div className="pickup-form-section">
            <h3>PUR Details</h3>
            <div className="form-grid">
              <label>
                Service type *
                <select
                  name="serviceType"
                  value={serviceType}
                  onChange={(event) => setServiceType(event.target.value)}
                  required
                >
                  <option value="FTL">FTL</option>
                  <option value="PTL">PTL</option>
                </select>
              </label>
              {serviceType === 'PTL' && (
                <label>
                  PTL movement *
                  <select name="movementType" required defaultValue="">
                    <option value="" disabled>Select movement</option>
                    <option value="HUB_TO_HUB">Hub - Hub</option>
                    <option value="DOOR_TO_DOOR">Door - Door</option>
                    <option value="HUB_TO_DOOR">Hub - Door</option>
                    <option value="DOOR_TO_HUB">Door - Hub</option>
                  </select>
                </label>
              )}
              <label>
                Total boxes *
                <input name="totalBoxes" type="number" min="1" max="10000" step="1" required />
              </label>
              <label>
                Total weight (kg) *
                <input name="totalWeightKg" type="number" min="0.01" max="100000" step="0.01" required />
              </label>
            </div>
          </div>
          <div className="pickup-form-actions">
            <p>The client notification will be queued immediately after PUR generation.</p>
            <button className="btn" disabled={create.isPending}>
              <Plus size={17} /> {create.isPending ? 'Generating…' : 'Generate PUR'}
            </button>
          </div>
        </form>
      </section>
      <section className="panel">
        <div className="panel-heading pickup-register-heading">
          <div>
            <h2>Pickup request register</h2>
            <p>Employees can monitor pending and dispatched pickup requests.</p>
          </div>
          <select
            aria-label="Filter pickup requests by status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="DISPATCHED">Dispatched</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
        {list.isPending ? (
          <Loadingcrleleton />
        ) : list.isError ? (
          <ErrorState error={errorMessage(list.error)} retry={list.refetch} />
        ) : (
          <DataTable
            rows={list.data.data}
            pagination={list.data.pagination}
            onPage={setPage}
            empty="No pickup requests found"
            columns={[
              { key: 'pickupRequestNumber', label: 'PUR number' },
              { key: 'createdAt', label: 'Created', render: (row) => date(row.createdAt) },
              { key: 'shipper', label: 'Shipper', render: (row) => row.shipper?.companyName },
              { key: 'recipient', label: 'Consignee', render: (row) => row.recipient?.companyName },
              { key: 'serviceType', label: 'Service' },
              { key: 'totalBoxes', label: 'Boxes' },
              { key: 'totalWeightKg', label: 'Weight (kg)' },
              { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
              {
                key: 'action',
                label: 'Action',
                render: (row) => row.pickupRunSheetId ? (
                  <Link className="text-btn" to={`${base}/pickup-run-sheets/${idOf(row.pickupRunSheetId)}`}>
                    View {row.pickupRunSheetId.prsNumber}
                  </Link>
                ) : row.status === 'PENDING' && row.shipmentId ? (
                  <Link className="text-btn" to={`${base}/pickup-run-sheets`}>Create PRS</Link>
                ) : row.status === 'PENDING' && row.agentAssignment ? (
                  <Link className="text-btn" to={`${base}/shipments/create?pickupRequest=${idOf(row)}`}>Create LR</Link>
                ) : row.status === 'PENDING' ? (
                  <Link className="text-btn" to={`${base}/agent-alignment`}>Align agent</Link>
                ) : '—',
              },
            ]}
          />
        )}
      </section>
    </>
  );
}
