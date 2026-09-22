import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { bookingsApi } from '../api/services';
import { errorMessage } from '../api/client';
import { DataTable, ErrorState, Loadingcrleleton, Modal, PageHeader, StatusBadge } from '../components/common/UI';
import CustomerCodeLookup from '../components/forms/CustomerCodeLookup';
import { useAuth } from '../features/auth/AuthContext';
import { date } from '../lib/workflow';

const partyFields = [
  ['consignorCode', 'Consignor code'],
  ['consignor', 'Consignor name', true],
  ['consignorAddress', 'Consignor address - line 1'],
  ['consignorAddress2', 'Consignor address - line 2'],
  ['consignorPincode', 'Consignor PIN code'],
  ['consignorGstin', 'Consignor GSTIN'],
  ['consignee', 'Consignee name', true],
  ['consigneeMobile', 'Consignee mobile'],
  ['consigneeAddress', 'Consignee address - line 1'],
  ['consigneeAddress2', 'Consignee address - line 2'],
  ['consigneeAddress3', 'Consignee address - line 3'],
  ['consigneePincode', 'Consignee PIN code'],
  ['consigneeGstin', 'Consignee GSTIN'],
];

export default function BookingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const client = useQueryClient();
  const formRef = useRef(null);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const query = useQuery({ queryKey: ['bookings', page], queryFn: () => bookingsApi.list({ page, limit: 20 }) });
  const create = useMutation({
    mutationFn: bookingsApi.create,
    onSuccess: () => {
      toast.success('Booking created');
      setOpen(false);
      setCustomerId('');
      client.invalidateQueries({ queryKey: ['bookings'] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const save = (event) => {
    event.preventDefault();
    const raw = Object.fromEntries(new FormData(event.currentTarget));
    const data = Object.fromEntries(Object.entries(raw).filter(([, value]) => value !== ''));
    create.mutate({ ...data, customerId });
  };
  const fillCustomer = (customer) => {
    if (!customer || !formRef.current) return;
    const values = {
      consignorCode: customer.customerCode,
      consignor: customer.name,
      consignorAddress: customer.address || '',
      consignorAddress2: customer.address2 || '',
      consignorPincode: customer.pincode || '',
      consignorGstin: customer.gstNumber || '',
    };
    for (const [name, value] of Object.entries(values)) {
      const input = formRef.current.elements.namedItem(name);
      if (input) input.value = value;
    }
  };
  const openCreateLr = (booking) => {
    const id = booking.id || booking._id;
    navigate(`/${user.role.toLowerCase()}/shipments/create?booking=${encodeURIComponent(id)}`);
  };

  return <>
    <PageHeader title="Booking / Order" description="Capture consignor and consignee details, then complete the LR.">
      <button className="btn" onClick={() => { setCustomerId(''); setOpen(true); }}><Plus size={17} /> New booking</button>
    </PageHeader>
    <section className="panel">
      {query.isPending ? <Loadingcrleleton /> : query.isError ? <ErrorState error={errorMessage(query.error)} retry={query.refetch} /> : <DataTable
        rows={query.data.data}
        pagination={query.data.pagination}
        onPage={setPage}
        columns={[
          { key: 'bookingNumber', label: 'Booking' },
          { key: 'bookingDate', label: 'Date', render: (row) => date(row.bookingDate || row.createdAt) },
          { key: 'consignor', label: 'Consignor' },
          { key: 'consignee', label: 'Consignee' },
          { key: 'consigneeMobile', label: 'Mobile', render: (row) => row.consigneeMobile || '-' },
          { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
          { key: 'lr', label: 'LR', render: (row) => row.shipmentId?.lrNumber || (row.status !== 'CANCELLED' && <button className="text-btn" onClick={() => openCreateLr(row)}>Generate LR</button>) },
        ]}
      />}
    </section>
    {open && <Modal title="New booking" onClose={() => { setOpen(false); setCustomerId(''); }}>
      <form ref={formRef} onSubmit={save}>
        <div className="form-grid">
          <div className="full-span">
            <CustomerCodeLookup value={customerId} onChange={setCustomerId} onCustomer={fillCustomer} />
          </div>
          {partyFields.map(([name, label, required]) => <label key={name}>{label}<input name={name} required={required} maxLength={name.includes('Address') ? 500 : 120} /></label>)}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn secondary" onClick={() => { setOpen(false); setCustomerId(''); }}>Cancel</button>
          <button className="btn" disabled={create.isPending || !customerId}>{create.isPending ? 'Saving…' : 'Save booking'}</button>
        </div>
      </form>
    </Modal>}
  </>;
}
