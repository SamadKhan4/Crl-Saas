import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { customersApi, pickupRequestsApi } from '../../api/services';
import { errorMessage } from '../../api/client';
import { idOf } from '../../lib/workflow';
import { Modal } from '../common/UI';

const fields = [
  ['companyName', 'Company name', 'text'], ['city', 'City', 'text'],
  ['address', 'Address', 'text'], ['pincode', 'PIN code', 'text'],
  ['gstin', 'GSTIN', 'text'], ['contactName', 'Contact person', 'text'],
  ['contactMobile', 'Contact mobile', 'tel'],
];

export default function CreditPickupRequestModal({ onClose, onCreated }) {
  const [search, setSearch] = useState('');
  const [customer, setCustomer] = useState(null);
  const [shipper, setShipper] = useState({});
  const [recipient, setRecipient] = useState({});
  const [serviceType, setServiceType] = useState('PTL');
  const customers = useQuery({
    queryKey: ['credit-customer-lookup', search],
    queryFn: () => customersApi.lookup({ customerType: 'CREDIT', search, limit: 3 }),
  });
  const create = useMutation({
    mutationFn: (body) => pickupRequestsApi.create(body),
    onSuccess: ({ data }) => {
      toast.success(`Credit pickup request ${data.pickupRequestNumber} created. Assign its agent next.`);
      onCreated(data);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const chooseCustomer = (value) => {
    const selected = (customers.data?.data || []).find((row) => idOf(row) === value);
    setCustomer(selected || null);
    setShipper(selected ? {
      companyName: selected.companyName || selected.name || '', city: selected.city || '',
      address: selected.address || '', pincode: selected.pincode || '',
      gstin: selected.gstNumber || '', contactName: selected.name || '', contactMobile: selected.mobile || '',
    } : {});
  };
  const submit = (event) => {
    event.preventDefault();
    if (!customer || create.isPending) return;
    const form = new FormData(event.currentTarget);
    const clean = (party) => Object.fromEntries(Object.entries(party).map(([key, value]) => [key, value.trim()]).filter(([, value]) => value));
    create.mutate({
      customerId: idOf(customer), shipper: clean(shipper), recipient: clean(recipient), serviceType,
      ...(serviceType === 'PTL' && { movementType: form.get('movementType') }),
      ...(form.get('totalBoxes') && { totalBoxes: Number(form.get('totalBoxes')) }),
      ...(form.get('totalWeightKg') && { totalWeightKg: Number(form.get('totalWeightKg')) }),
    });
  };
  return <Modal title="New credit customer request" onClose={create.isPending ? () => {} : onClose}>
    <form onSubmit={submit}>
      <p>Create a pickup request, assign its agent, then create the LR and PRS.</p>
      <div className="form-grid">
        <label className="full-span">Search credit customer
          <input maxLength={100} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Customer name, code or mobile" />
        </label>
        <label className="full-span">Credit customer *
          <select required value={idOf(customer) || ''} onChange={(event) => chooseCustomer(event.target.value)}>
            <option value="">Select credit customer</option>
            {customer && !(customers.data?.data || []).some((row) => idOf(row) === idOf(customer)) && <option value={idOf(customer)}>{customer.customerCode} ? {customer.companyName || customer.name}</option>}
            {(customers.data?.data || []).map((row) => <option key={idOf(row)} value={idOf(row)}>{row.customerCode} ? {row.companyName || row.name}</option>)}
          </select>
        </label>
      </div>
      {customers.isPending && <p>Loading credit customers...</p>}
      {customers.isError && <p role="alert">{errorMessage(customers.error)} <button type="button" className="text-btn" onClick={() => customers.refetch()}>Retry</button></p>}
      {!customers.isPending && !customers.isError && !customers.data?.data?.length && <p>No matching active credit customers. Try another name or code.</p>}
      {[['Shipper details', shipper, setShipper], ['Recipient details', recipient, setRecipient]].map(([title, party, setParty]) => <div className="pickup-form-section" key={title}>
        <h3>{title}</h3><div className="form-grid">
          {fields.map(([key, label, type]) => <label key={key}>{label}{['companyName', 'city'].includes(key) ? ' *' : ''}
            <input type={type} required={['companyName', 'city'].includes(key)} maxLength={key === 'address' ? 500 : key === 'contactMobile' ? 16 : key === 'city' ? 100 : key === 'contactName' ? 120 : 150} pattern={key === 'pincode' ? '\\d{6}' : undefined} value={party[key] || ''} onChange={(event) => setParty((current) => ({ ...current, [key]: event.target.value }))} />
          </label>)}
        </div>
      </div>)}
      <div className="form-grid">
        <label>Service type *<select required value={serviceType} onChange={(event) => setServiceType(event.target.value)}><option value="PTL">PTL</option><option value="FTL">FTL</option></select></label>
        {serviceType === 'PTL' && <label>PTL movement *<select required name="movementType" defaultValue="DOOR_TO_DOOR"><option value="DOOR_TO_DOOR">Door - Door</option><option value="DOOR_TO_HUB">Door - Hub</option><option value="HUB_TO_DOOR">Hub - Door</option><option value="HUB_TO_HUB">Hub - Hub</option></select></label>}
        <label>Total boxes<input name="totalBoxes" type="number" min="1" max="10000" step="1" /></label>
        <label>Total weight (kg)<input name="totalWeightKg" type="number" min="0.01" max="100000" step="0.01" /></label>
      </div>
      <div className="modal-footer">
        <button type="button" className="btn secondary" disabled={create.isPending} onClick={onClose}>Cancel</button>
        <button className="btn" disabled={!customer || create.isPending}>{create.isPending ? 'Creating...' : 'Create request & assign agent'}</button>
      </div>
    </form>
  </Modal>;
}
