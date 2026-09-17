import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation } from 'react-router-dom';
import { Plus, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage, get } from '../api/client';
import {
  drsApi,
  invoicesApi,
  manifestsApi,
  quotationsApi,
  receiptsApi,
  stationeryApi,
  tripsApi,
  vendorsApi,
} from '../api/services';
import { useAuth } from '../features/auth/AuthContext';
import { useDebounce, useList } from '../hooks/useList';
import { date, idOf, label } from '../lib/workflow';
import Lookup from '../components/forms/Lookup';
import SearchInput from '../components/forms/SearchInput';
import {
  DataTable,
  ErrorState,
  FormField,
  Loadingcrleleton,
  Modal,
  PageHeader,
  StatusBadge,
} from '../components/common/UI';

const today = () => new Date().toLocaleDateString('en-CA');
const money = (value) =>
  value == null
    ? '—'
    : Number(value).toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
const option = (values) => values.map((value) => [value, label(value)]);

const configs = {
  vendors: {
    title: 'Vendor master',
    singular: 'vendor',
    service: vendorsApi,
    number: 'vendorCode',
    adminOnlyCreate: true,
    description: 'Maintain co-loaders, transport vendors, commercials and mapped vehicles.',
    primary: (row) => row.name,
    secondary: (row) => `${label(row.vendorType)} · ${row.mobile}`,
    fields: [
      [
        'vendorType',
        'Vendor type',
        'select',
        option(['TRANSPORTER', 'CO_LOADER', 'VEHICLE_OWNER', 'LAST_MILE']),
      ],
      ['name', 'Vendor / company name'],
      ['contactPerson', 'Contact person'],
      ['mobile', 'Mobile', 'tel'],
      ['email', 'Email', 'email'],
      ['gstNumber', 'GSTIN'],
      ['address', 'Address'],
      ['city', 'City'],
      ['state', 'State'],
      ['pincode', 'Pincode'],
      [
        'commercial.rateBasis',
        'Rate basis',
        'select',
        option(['PER_KG', 'PER_BOX', 'PER_TRIP', 'FIXED']),
      ],
      ['commercial.rate', 'Base rate', 'number'],
      ['commercial.fuelSurchargePercent', 'Fuel surcharge %', 'number'],
      ['commercial.handlingCharge', 'Handling charge', 'number'],
      ['commercial.detentionPerDay', 'Detention / day', 'number'],
      ['commercial.creditDays', 'Credit days', 'number'],
      ['commercial.gstRate', 'GST %', 'number'],
      ['vehicle.vehicleNumber', 'Mapped vehicle number'],
      ['vehicle.vehicleType', 'Vehicle type'],
      ['vehicle.capacityKg', 'Vehicle capacity (kg)', 'number'],
      ['vehicle.driverName', 'Default driver'],
      ['vehicle.driverMobile', 'Driver mobile', 'tel'],
    ],
    defaults: {
      vendorType: 'TRANSPORTER',
      commercial: {
        rateBasis: 'PER_TRIP',
        rate: 0,
        fuelSurchargePercent: 0,
        handlingCharge: 0,
        detentionPerDay: 0,
        creditDays: 0,
        gstRate: 0,
      },
      vehicle: {},
    },
    edit: true,
  },
  manifests: {
    title: 'Manifestation',
    singular: 'manifest',
    service: manifestsApi,
    number: 'manifestNumber',
    description: 'Group LRs under a co-loader and keep its movement status current.',
    primary: (row) => row.destination,
    secondary: (row) => row.vendorId?.name || 'Co-loader',
    count: true,
    fields: [
      ['vendorId', 'Co-loader / transporter', 'lookup', 'vendors'],
      ['destination', 'Destination'],
      ['shipmentIds', 'LRs on manifest', 'shipments', ['BOOKED', 'IN_TRANSIT']],
      ['vendorReference', 'Vendor reference'],
      ['remarks', 'Remarks', 'textarea'],
    ],
    action: {
      label: 'Update status',
      path: 'status',
      fields: [
        [
          'coLoaderStatus',
          'Co-loader status',
          'select',
          option([
            'BOOKED',
            'PICKED_UP',
            'IN_TRANSIT',
            'AT_HUB',
            'OUT_FOR_DELIVERY',
            'DELIVERED',
            'EXCEPTION',
          ]),
        ],
        ['remarks', 'Remarks', 'textarea'],
      ],
    },
  },
  trips: {
    title: 'Trip planning & dispatch',
    singular: 'trip',
    service: tripsApi,
    number: 'tripNumber',
    description: 'Plan vehicle movement, assign LRs and control dispatch milestones.',
    primary: (row) => `${row.origin} → ${row.destination}`,
    secondary: (row) => `${row.vehicleNumber} · ${row.driverName}`,
    count: true,
    fields: [
      ['vendorId', 'Vehicle vendor', 'lookup', 'vendors'],
      ['vehicleNumber', 'Vehicle number'],
      ['driverName', 'Driver name'],
      ['driverMobile', 'Driver mobile', 'tel'],
      ['origin', 'Origin'],
      ['destination', 'Destination'],
      ['departureDate', 'Departure date', 'date'],
      ['expectedArrival', 'Expected arrival', 'date'],
      ['shipmentIds', 'LRs on trip', 'shipments', ['BOOKED']],
      ['freightAmount', 'Vendor freight', 'number'],
      ['advanceAmount', 'Advance paid', 'number'],
      ['remarks', 'Remarks', 'textarea'],
    ],
    defaults: { departureDate: today(), freightAmount: 0, advanceAmount: 0 },
    action: {
      label: 'Move trip',
      path: 'status',
      fields: [
        [
          'status',
          'Next status',
          'select',
          option(['DISPATCHED', 'ARRIVED', 'CLOSED', 'CANCELLED']),
        ],
        ['remarks', 'Remarks', 'textarea'],
      ],
    },
  },
  drs: {
    title: 'Delivery run sheets',
    singular: 'DRS',
    service: drsApi,
    number: 'drsNumber',
    description: 'Assign last-mile runs, update Part B vehicle data and close only after POD.',
    primary: (row) => row.route,
    secondary: (row) => `${row.vehicleNumber} · ${row.driverName}`,
    count: true,
    fields: [
      ['vehicleNumber', 'Vehicle number'],
      ['driverName', 'Driver name'],
      ['driverMobile', 'Driver mobile', 'tel'],
      ['deliveryDate', 'Delivery date', 'date'],
      ['route', 'Delivery route'],
      [
        'shipmentIds',
        'LRs on DRS',
        'shipments',
        ['RECEIVED', 'LR_IMAGE_UPLOADED', 'LR_IMAGE_VERIFIED', 'COMPLETED'],
      ],
      ['partB.eWayBillNo', 'E-way bill number'],
      ['partB.vehicleNumber', 'Part B vehicle number'],
      ['remarks', 'Remarks', 'textarea'],
    ],
    defaults: { deliveryDate: today(), partB: {} },
    manage: true,
  },
  invoices: {
    title: 'Credit client billing',
    singular: 'invoice',
    service: invoicesApi,
    number: 'invoiceNumber',
    description: 'Create controlled GST invoices from delivered, unbilled credit-client LRs.',
    primary: (row) => row.customerId?.name || 'Customer',
    secondary: (row) => money(row.totalAmount),
    count: true,
    fields: [
      ['customerId', 'Credit customer', 'lookup', 'customers'],
      ['shipmentIds', 'Delivered LRs', 'shipments', ['COMPLETED', 'CLOSED']],
      ['periodFrom', 'Billing period from', 'date'],
      ['periodTo', 'Billing period to', 'date'],
      ['issueDate', 'Invoice date', 'date'],
      ['dueDate', 'Due date', 'date'],
      ['gstRate', 'GST %', 'number'],
      ['notes', 'Notes', 'textarea'],
    ],
    defaults: { issueDate: today(), gstRate: 0 },
    action: {
      label: 'Invoice action',
      path: 'status',
      fields: [
        ['status', 'Action', 'select', option(['ISSUED', 'CANCELLED'])],
        ['notes', 'Reason / notes', 'textarea'],
      ],
    },
    amount: 'balanceAmount',
  },
  'money-receipts': {
    title: 'Money receipts',
    singular: 'receipt',
    service: receiptsApi,
    number: 'receiptNumber',
    description: 'Record customer collections with payment reference and invoice allocation.',
    primary: (row) => row.receivedFrom,
    secondary: (row) => row.customerId?.name || row.paymentMode,
    fields: [
      ['customerId', 'Customer', 'lookup', 'customers'],
      ['receivedFrom', 'Received from'],
      ['amount', 'Amount received', 'number'],
      ['paymentMode', 'Payment mode', 'select', option(['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE'])],
      ['transactionReference', 'Transaction / cheque reference'],
      ['receiptDate', 'Receipt date', 'date'],
      ['allocation.invoiceId', 'Allocate to invoice', 'lookup', 'invoices'],
      ['allocation.amount', 'Allocation amount', 'number'],
      ['remarks', 'Remarks', 'textarea'],
    ],
    defaults: { paymentMode: 'CASH', receiptDate: today(), allocation: {} },
    amount: 'amount',
  },
  quotations: {
    title: 'Quotations',
    singular: 'quotation',
    service: quotationsApi,
    number: 'quotationNumber',
    description: 'Handle website enquiries and issue a consistent transport quotation.',
    primary: (row) => row.companyName || row.leadName,
    secondary: (row) => `${row.origin} → ${row.destination}`,
    fields: [
      ['customerId', 'Existing customer', 'lookup', 'customers'],
      ['leadName', 'Contact name'],
      ['companyName', 'Company'],
      ['mobile', 'Mobile', 'tel'],
      ['email', 'Email', 'email'],
      ['origin', 'Origin'],
      ['destination', 'Destination'],
      ['goodsDescription', 'Goods description', 'textarea'],
      ['packageCount', 'Packages', 'number'],
      ['weightKg', 'Weight (kg)', 'number'],
      ['estimatedFreight', 'Estimated freight', 'number'],
      ['gstRate', 'GST %', 'number'],
      ['validUntil', 'Valid until', 'date'],
      ['notes', 'Commercial notes', 'textarea'],
    ],
    defaults: { packageCount: 1, estimatedFreight: 0, gstRate: 0 },
    amount: 'totalAmount',
    action: {
      label: 'Update quote',
      path: 'status',
      fields: [
        ['status', 'Status', 'select', option(['QUOTED', 'ACCEPTED', 'REJECTED', 'EXPIRED'])],
        ['estimatedFreight', 'Estimated freight', 'number'],
        ['gstRate', 'GST %', 'number'],
        ['validUntil', 'Valid until', 'date'],
        ['notes', 'Notes', 'textarea'],
      ],
    },
  },
  stationery: {
    title: 'Stationery register',
    singular: 'transaction',
    service: stationeryApi,
    number: 'transactionNumber',
    description:
      'Receive stock and issue controlled stationery to vendors, branches or field executives.',
    primary: (row) => label(row.itemType),
    secondary: (row) => `${label(row.transactionType)} · Qty ${row.quantity}`,
    fields: [
      [
        'itemType',
        'Stationery item',
        'select',
        option(['LR_BOOK', 'POD_BOOK', 'MONEY_RECEIPT_BOOK', 'LABEL', 'OTHER']),
      ],
      ['transactionType', 'Transaction', 'select', option(['RECEIVE', 'ISSUE'])],
      ['quantity', 'Quantity', 'number'],
      ['serialFrom', 'Serial from'],
      ['serialTo', 'Serial to'],
      ['issuedToType', 'Issue to', 'select', option(['VENDOR', 'FE', 'BRANCH'])],
      ['vendorId', 'Vendor', 'lookup', 'vendors'],
      ['issuedToName', 'Field executive / recipient'],
      ['transactionDate', 'Date', 'date'],
      ['remarks', 'Remarks', 'textarea'],
    ],
    defaults: {
      itemType: 'LR_BOOK',
      transactionType: 'RECEIVE',
      quantity: 1,
      transactionDate: today(),
    },
  },
};

const valueAt = (source, path) => path.split('.').reduce((value, key) => value?.[key], source);
const setAt = (source, path, value) => {
  const keys = path.split('.');
  const copy = structuredClone(source);
  let target = copy;
  keys.slice(0, -1).forEach((key) => {
    target[key] = target[key] || {};
    target = target[key];
  });
  target[keys.at(-1)] = value;
  return copy;
};
const clean = (value) => {
  if (Array.isArray(value)) return value.map(clean);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).flatMap(([key, item]) => {
        const normalized = clean(item);
        return normalized === '' ||
          normalized == null ||
          (typeof normalized === 'object' &&
            !Array.isArray(normalized) &&
            !Object.keys(normalized).length)
          ? []
          : [[key, normalized]];
      }),
    );
  return value;
};

function prepare(resource, values) {
  const payload = clean(values);
  if (resource === 'vendors') {
    return {
      vendorType: payload.vendorType,
      name: payload.name,
      contactPerson: payload.contactPerson,
      mobile: payload.mobile,
      email: payload.email,
      address: payload.address,
      city: payload.city,
      state: payload.state,
      pincode: payload.pincode,
      gstNumber: payload.gstNumber,
      commercial: payload.commercial,
      vehicles: payload.vehicle?.vehicleNumber ? [{ ...payload.vehicle, status: 'ACTIVE' }] : [],
    };
  }
  if (resource === 'drs')
    payload.partB = payload.partB?.eWayBillNo
      ? [{ ...payload.partB, vehicleNumber: payload.partB.vehicleNumber || payload.vehicleNumber }]
      : [];
  if (resource === 'money-receipts') {
    payload.allocations = payload.allocation?.invoiceId
      ? [
          {
            invoiceId: payload.allocation.invoiceId,
            amount: payload.allocation.amount || payload.amount,
          },
        ]
      : [];
    payload.shipmentIds = [];
    delete payload.allocation;
  }
  return payload;
}

function ShipmentPicker({ value = [], onChange, statuses }) {
  const [search, setSearch] = useState('');
  const term = useDebounce(search);
  const query = useQuery({
    queryKey: ['shipments', 'tms-picker', term],
    queryFn: () => get('/shipments', { search: term, limit: 100 }),
  });
  const rows = (query.data?.data || []).filter((row) => statuses.includes(row.currentStatus));
  return (
    <div className="field tms-span-2">
      <label>Search and select LRs</label>
      <input
        value={search}
        maxLength={100}
        placeholder="LR number, customer or route"
        onChange={(event) => setSearch(event.target.value)}
      />
      {query.isPending ? (
        <small>Loading eligible LRs…</small>
      ) : query.isError ? (
        <small className="field-error">{errorMessage(query.error)}</small>
      ) : (
        <div className="tms-checklist">
          {rows.length ? (
            rows.map((row) => (
              <label key={idOf(row)}>
                <input
                  type="checkbox"
                  checked={value.includes(idOf(row))}
                  onChange={(event) =>
                    onChange(
                      event.target.checked
                        ? [...value, idOf(row)]
                        : value.filter((item) => item !== idOf(row)),
                    )
                  }
                />
                <span>
                  <b>{row.lrNumber}</b>
                  <small>
                    {row.senderName} → {row.receiverName} · {label(row.currentStatus)}
                  </small>
                </span>
              </label>
            ))
          ) : (
            <small>No eligible LRs found.</small>
          )}
        </div>
      )}
      <small>{value.length} LR selected</small>
    </div>
  );
}

function DynamicFields({ fields, values, setValues }) {
  return fields.map(([name, caption, type = 'text', meta]) => {
    const value = valueAt(values, name) ?? '';
    const change = (next) => setValues((current) => setAt(current, name, next));
    if (type === 'lookup')
      return (
        <Lookup
          key={name}
          resource={meta}
          label={caption}
          value={value}
          onChange={change}
          activeOnly={meta !== 'invoices'}
        />
      );
    if (type === 'shipments')
      return <ShipmentPicker key={name} value={value || []} onChange={change} statuses={meta} />;
    if (type === 'select')
      return (
        <div className="field" key={name}>
          <label htmlFor={name}>{caption}</label>
          <select id={name} value={value} onChange={(event) => change(event.target.value)}>
            <option value="">Select {caption.toLowerCase()}</option>
            {meta.map(([key, text]) => (
              <option value={key} key={key}>
                {text}
              </option>
            ))}
          </select>
        </div>
      );
    if (type === 'textarea')
      return (
        <div className="field tms-span-2" key={name}>
          <label htmlFor={name}>{caption}</label>
          <textarea
            id={name}
            value={value}
            maxLength={1000}
            onChange={(event) => change(event.target.value)}
          />
        </div>
      );
    return (
      <FormField
        key={name}
        name={name}
        label={caption}
        type={type}
        value={value}
        min={type === 'number' ? 0 : undefined}
        step={type === 'number' ? 'any' : undefined}
        onChange={(event) => change(event.target.value)}
      />
    );
  });
}

function RecordEditor({ resource, config, record, onClose }) {
  const { user } = useAuth();
  const [values, setValues] = useState(() =>
    record
      ? {
          ...record,
          vehicle: record.vehicles?.[0] || {},
        }
      : structuredClone(config.defaults || {}),
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const cache = useQueryClient();
  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const payload = prepare(resource, values);
      if (record) await config.service.update(idOf(record), payload);
      else await config.service.create(payload);
      cache.invalidateQueries({ queryKey: [resource] });
      toast.success(`${config.title} saved`);
      onClose();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={`${record ? 'Edit' : 'Add'} ${config.singular}`}
      onClose={() => !busy && onClose()}
    >
      <form onSubmit={save}>
        <div className="form-grid">
          {user.role === 'ADMIN' && resource !== 'vendors' && (
            <Lookup
              resource="branches"
              branchOptions
              label="Operating branch"
              value={values.branchId || ''}
              onChange={(value) => setValues((current) => ({ ...current, branchId: value }))}
            />
          )}
          <DynamicFields fields={config.fields} values={values} setValues={setValues} />
        </div>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-footer">
          <button type="button" className="btn secondary" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button className="btn" disabled={busy}>
            {busy ? 'Saving…' : `Save ${config.singular}`}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function StatusEditor({ resource, config, record, onClose }) {
  const [values, setValues] = useState({});
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const cache = useQueryClient();
  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.patch(`/${resource}/${idOf(record)}/${config.action.path}`, clean(values));
      cache.invalidateQueries({ queryKey: [resource] });
      toast.success('Status updated');
      onClose();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={`${config.action.label} · ${record[config.number]}`}
      onClose={() => !busy && onClose()}
    >
      <form onSubmit={save}>
        <div className="form-grid">
          <DynamicFields fields={config.action.fields} values={values} setValues={setValues} />
        </div>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-footer">
          <button type="button" className="btn secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" disabled={busy}>
            {busy ? 'Updating…' : 'Confirm update'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function TmsModulePage() {
  const resource = useLocation().pathname.replace(/\/+$/, '').split('/').at(-1);
  const config = configs[resource];
  const { user } = useAuth();
  const { query, filters, update, clear, sort } = useList(resource, config.service);
  const [editor, setEditor] = useState(null),
    [action, setAction] = useState(null);
  const base = `/${user.role.toLowerCase()}`;
  const columns = useMemo(
    () => [
      {
        key: 'number',
        label: 'Number',
        sort: config.number,
        render: (row) => <strong>{row[config.number]}</strong>,
      },
      {
        key: 'record',
        label: config.singular,
        render: (row) => (
          <div>
            <strong>{config.primary(row)}</strong>
            <small className="tms-table-subtitle">{config.secondary(row)}</small>
          </div>
        ),
      },
      ...(config.count
        ? [{ key: 'shipmentCount', label: 'LRs', render: (row) => row.shipmentIds?.length || 0 }]
        : []),
      ...(config.amount
        ? [{ key: 'amount', label: 'Amount', render: (row) => money(row[config.amount]) }]
        : []),
      {
        key: 'status',
        label: 'Status',
        render: (row) => (
          <StatusBadge status={resource === 'manifests' ? row.coLoaderStatus : row.status} />
        ),
      },
      {
        key: 'createdAt',
        label: 'Created',
        sort: 'createdAt',
        render: (row) => date(row.createdAt),
      },
      {
        key: 'actions',
        label: 'Actions',
        render: (row) => (
          <div className="row-actions">
            {config.manage && (
              <Link className="text-btn" to={`${base}/drs/${idOf(row)}`}>
                Manage POD
              </Link>
            )}
            {config.edit && user.role === 'ADMIN' && (
              <button className="text-btn" onClick={() => setEditor(row)}>
                Edit
              </button>
            )}
            {config.action && (
              <button className="text-btn" onClick={() => setAction(row)}>
                {config.action.label}
              </button>
            )}
          </div>
        ),
      },
    ],
    [base, config, resource, user.role],
  );
  const canCreate = !config.adminOnlyCreate || user.role === 'ADMIN';
  return (
    <>
      <PageHeader title={config.title} description={config.description}>
        {canCreate && (
          <button className="btn" onClick={() => setEditor({})}>
            <Plus size={17} /> Add {config.singular}
          </button>
        )}
      </PageHeader>
      <section className="panel">
        <div className="filter-bar">
          <SearchInput value={filters.search || ''} onChange={(value) => update('search', value)} />
          <select
            aria-label="Status"
            value={filters.status || ''}
            onChange={(event) => update('status', event.target.value)}
          >
            <option value="">All statuses</option>
          </select>
          <button className="text-btn" onClick={clear}>
            <RefreshCw size={14} /> Clear
          </button>
        </div>
        {query.isPending ? (
          <Loadingcrleleton />
        ) : query.isError ? (
          <ErrorState error={errorMessage(query.error)} retry={query.refetch} />
        ) : (
          <DataTable
            rows={query.data.data}
            columns={columns}
            pagination={query.data.pagination}
            onPage={(page) => update('page', page)}
            onSort={sort}
          />
        )}
      </section>
      {editor && (
        <RecordEditor
          resource={resource}
          config={config}
          record={idOf(editor) ? editor : null}
          onClose={() => setEditor(null)}
        />
      )}
      {action && (
        <StatusEditor
          resource={resource}
          config={config}
          record={action}
          onClose={() => setAction(null)}
        />
      )}
    </>
  );
}
