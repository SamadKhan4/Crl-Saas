import { useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { useList } from '../hooks/useList';
import { resourceApi } from '../api/services';
import { errorMessage, formErrors, post } from '../api/client';
import { customerSchema, branchSchema, userSchema } from '../schemas';
import {
  PageHeader,
  Loadingcrleleton,
  ErrorState,
  DataTable,
  StatusBadge,
  Modal,
  FormField,
  ConfirmDialog,
} from '../components/common/UI';
import SearchInput from '../components/forms/SearchInput';
import Lookup from '../components/forms/Lookup';
import CreditRateCardField from '../components/forms/CreditRateCardField';
import CreditChargesFields from '../components/forms/CreditChargesFields';
import { CustomerBillingField, CustomerContactsField, CustomerLocationsField, CustomerServicesField } from '../components/forms/CustomerBusinessFields';
import { date, idOf } from '../lib/workflow';
import { useAuth } from '../features/auth/AuthContext';
const configs = {
  customers: {
    title: 'Customers',
    singular: 'customer',
    schema: customerSchema,
    fields: [
      ['customerType', 'Customer type', 'customerType'],
      ['name', 'Name'],
      ['companyName', 'Company'],
      ['legalName', 'Legal name'],
      ['tradeName', 'Trade name'],
      ['industry', 'Industry'],
      ['mobile', 'Mobile'],
      ['alternateMobile', 'Alternate mobile'],
      ['email', 'Email', 'email'],
      ['address', 'Address'],
      ['city', 'City'],
      ['state', 'State'],
      ['pincode', 'Pincode'],
      ['gstNumber', 'GST number'],
      ['panNumber', 'PAN'],
      ['gstType', 'GST type'],
      ['billingState', 'Billing state'],
      ['billingAddress', 'Billing address'],
      ['pickupLocations', 'Pickup locations', 'customerLocations'],
      ['deliveryLocations', 'Delivery locations', 'customerLocations'],
      ['services', 'Enabled services', 'customerServices'],
      ['billing', 'Billing & credit', 'customerBilling'],
      ['contacts', 'Contact persons', 'customerContacts'],
      ['creditRateCard', 'Location-wise credit rates', 'creditRateCard'],
      ['creditCharges', 'Additional contracted charges', 'creditCharges'],
    ],
  },
  branches: {
    title: 'Branches',
    singular: 'branch',
    schema: branchSchema,
    fields: [
      ['branchCode', 'Branch code'],
      ['name', 'Branch name'],
      ['city', 'City'],
      ['state', 'State'],
      ['address', 'Address'],
      ['pincode', 'Pincode'],
      ['phone', 'Phone'],
      ['email', 'Email', 'email'],
    ],
  },
  users: {
    title: 'Employees',
    singular: 'employee',
    schema: userSchema,
    fields: [
      ['name', 'Name'],
      ['email', 'Email', 'email'],
      ['mobile', 'Mobile'],
      ['branchId', 'Branch'],
      ['password', 'Initial password', 'password'],
    ],
  },
};
configs.managers = { ...configs.users, title: 'Managers', singular: 'manager' };
configs['hr-users'] = { ...configs.users, title: 'HR Users', singular: 'HR user' };
configs['vendor-users'] = { ...configs.users, title: 'Vendor Users', singular: 'vendor user', fields: [...configs.users.fields.slice(0, 4), ['vendorId', 'Vendor', 'vendorLookup'], configs.users.fields.at(-1)] };
export default function ManagementPage() {
  const location = useLocation();
  const pathname = location.pathname.replace(/\/+$/, '');
  const resource = pathname.endsWith('employees') ? 'users' : pathname.split('/').at(-1);
  return <Management key={resource} resource={resource} />;
}
function Management({ resource }) {
  const { user } = useAuth();
  const config = configs[resource],
    service = resourceApi(resource);
  const { query, filters, update, clear, sort } = useList(resource, service);
  const [search, setSearch] = useSearchParams();
  const [editor, setEditor] = useState(search.get('create') ? {} : null),
    [action, setAction] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [password, setPassword] = useState('');
  const cache = useQueryClient();
  function close() {
    setEditor(null);
    if (search.has('create'))
      setSearch((p) => {
        p.delete('create');
        return p;
      });
  }
  const columns = [
    { key: 'code', label: 'Code', render: (r) => r.customerCode || r.branchCode || r.employeeCode },
    {
      key: 'name',
      label: 'Name',
      sort: 'name',
      render: (r) =>
        resource === 'customers' ? (
          <Link className="lr-link" to={`${idOf(r)}`}>
            {r.name}
          </Link>
        ) : (
          <strong>{r.name}</strong>
        ),
    },
    ...(resource === 'branches'
      ? [
          { key: 'city', label: 'City' },
          { key: 'state', label: 'State' },
          { key: 'phone', label: 'Phone' },
        ]
      : [
          { key: 'email', label: 'Email' },
          { key: 'mobile', label: 'Mobile' },
          ...(['users', 'managers', 'hr-users'].includes(resource)
            ? [
                {
                  key: 'branchId',
                  label: 'Branch',
                  render: (r) => r.branchId?.name || idOf(r.branchId) || '—',
                },
                { key: 'role', label: 'Role' },
                { key: 'lastLoginAt', label: 'Last login', render: (r) => date(r.lastLoginAt) },
              ]
            : [
                ...(resource === 'customers' ? [
                  { key: 'customerType', label: 'Type', render: (r) => r.customerType === 'CREDIT' ? 'Credit' : 'To Pay / Paid' },
                  { key: 'creditRateCard', label: 'Rates', render: (r) => r.customerType === 'CREDIT' ? `${r.creditRateCard?.length || 0} locations` : '—' },
                ] : []),
                { key: 'companyName', label: 'Company' },
                { key: 'city', label: 'City' },
              ]),
        ]),
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'createdAt', label: 'Created', render: (r) => date(r.createdAt) },
    {
      key: 'actions',
      label: 'Actions',
      render: (r) => (
        <div className="row-actions">
          <button className="text-btn" onClick={() => setEditor(r)}>
            Edit
          </button>
          <button
            className="text-btn"
            onClick={() => {
              setAction({ row: r, type: 'status' });
              setError('');
            }}
          >
            {r.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
          </button>
          {['users', 'managers', 'hr-users', 'vendor-users'].includes(resource) && (
            <button
              className="text-btn"
              onClick={() => {
                setAction({ row: r, type: 'password' });
                setPassword('');
                setError('');
              }}
            >
              Reset password
            </button>
          )}
        </div>
      ),
    },
  ];
  async function confirm() {
    if (action.type === 'password' && (password.length < 12 || password.length > 128)) {
      setError('Password must contain 12–128 characters.');
      return;
    }
    setBusy(true);
    try {
      if (action.type === 'password')
        await post(`/${resource}/${idOf(action.row)}/reset-password`, { newPassword: password });
      else
        await service.status(
          idOf(action.row),
          action.row.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
        );
      cache.invalidateQueries({ queryKey: [resource] });
      toast.success('Record updated');
      setAction(null);
      setPassword('');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader
        title={config.title}
        description={`Manage your ${config.singular} directory and keep operations connected.`}
      >
        {!(resource === 'users' && user.role === 'MANAGER') && (
          <button className="btn" onClick={() => setEditor({})}>
            <Plus size={17} /> Add {config.singular}
          </button>
        )}
      </PageHeader>
      <section className="panel">
        <div className="filter-bar">
          <SearchInput value={filters.search} onChange={(v) => update('search', v)} />
          <select
            aria-label="Status"
            value={filters.status || ''}
            onChange={(e) => update('status', e.target.value)}
          >
            <option value="">All statuses</option>
            <option>ACTIVE</option>
            <option>INACTIVE</option>
          </select>
          <button className="text-btn" onClick={clear}>
            Clear filters
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
            onPage={(p) => update('page', p)}
            onSort={sort}
          />
        )}
      </section>
      {editor && <Editor resource={resource} config={config} record={editor} onClose={close} />}
      {action && (
        <ConfirmDialog
          title={
            action.type === 'password'
              ? 'Reset employee password'
              : `${action.row.status === 'ACTIVE' ? 'Deactivate' : 'Activate'} ${config.singular}`
          }
          description={`Confirm this change for ${action.row.name}.${action.type === 'password' ? ' Existing sessions will be revoked.' : ''}`}
          onClose={() => setAction(null)}
          onConfirm={confirm}
          pending={busy}
          error={error}
        >
          {action.type === 'password' && (
            <FormField
              label="New password"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
        </ConfirmDialog>
      )}
    </>
  );
}
function Editor({ resource, config, record, onClose }) {
  const editing = !!idOf(record);
  const schema =
    ['users', 'managers', 'hr-users', 'vendor-users'].includes(resource) && editing
      ? config.schema.omit({ password: true })
      : config.schema;
  const fields = [...config.fields]
    .filter(([key]) => !(editing && key === 'password'));
  const valueAt = (source, path) => path.split('.').reduce((value, key) => value?.[key], source);
  const defaultValues = Object.fromEntries(
    config.fields
      .filter(([key]) => !(editing && key === 'password'))
      .map(([key]) => [
        key,
        key === 'branchId' || key === 'vendorId'
          ? idOf(record[key]) || ''
          : key === 'creditRateCard'
            ? record[key] || []
            : key === 'creditCharges'
              ? record[key] || {}
            : ['pickupLocations', 'deliveryLocations', 'services', 'contacts', 'documents'].includes(key)
              ? record[key] || []
              : key === 'billing'
                ? record[key] || { creditLimit: 0, creditDays: 0, gstRate: 0, tdsRate: 0 }
                : record[key] ?? (key === 'customerType' ? 'TO_PAY_PAID' : ''),
      ]),
  );
  const {
    register,
    control,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues,
  });
  const [error, setMessage] = useState('');
  const customerType = resource === 'customers' ? watch('customerType') : undefined;
  const cache = useQueryClient();
  async function save(values) {
    if (editing) {
      const cleared = fields.find(([key]) => valueAt(record, key) && valueAt(values, key) === undefined);
      if (cleared) {
        setError(cleared[0], {
          message: `${cleared[1]} cannot be cleared. Enter a replacement value.`,
        });
        return;
      }
    }
    try {
      if (resource === 'customers' && values.customerType !== 'CREDIT') {
        values.creditRateCard = [];
        values.creditCharges = {};
      }
      const api = resourceApi(resource);
      if (editing) await api.update(idOf(record), values);
      else await api.create(values);
      cache.invalidateQueries({ queryKey: [resource] });
      toast.success(`${config.title} ${editing ? 'updated' : 'created'}`);
      onClose();
    } catch (e) {
      setMessage(errorMessage(e));
      formErrors(e, setError);
    }
  }
  return (
    <Modal
      title={`${editing ? 'Edit' : 'Add'} ${config.singular}`}
      onClose={() => !isSubmitting && onClose()}
    >
      <form onSubmit={handleSubmit(save)}>
        <div className="form-grid">
          {fields.map(([key, caption, type]) => (
            <div key={key} className={['creditRateCard', 'creditCharges', 'customerLocations', 'customerServices', 'customerBilling', 'customerContacts'].includes(type) ? 'tms-span-2' : undefined}>
              {key === 'branchId' ? (
                <Controller
                  name={key}
                  control={control}
                  render={({ field }) => <Lookup resource="branches" label="Branch" {...field} />}
                />
              ) : type === 'vendorLookup' ? (
                <Controller name={key} control={control} render={({ field }) => <Lookup resource="vendors" label="Vendor" {...field} />} />
              ) : type === 'customerType' ? (
                <div className="field">
                  <label htmlFor={key}>{caption}</label>
                  <select id={key} {...register(key)}>
                    <option value="TO_PAY_PAID">To Pay / Paid</option>
                    <option value="CREDIT">Credit</option>
                  </select>
                  {errors[key] && <small className="field-error">{errors[key].message}</small>}
                </div>
              ) : type === 'creditRateCard' ? (
                customerType === 'CREDIT' ? (
                  <CreditRateCardField control={control} error={errors.creditRateCard} />
                ) : null
              ) : type === 'creditCharges' ? (
                customerType === 'CREDIT' ? (
                  <CreditChargesFields register={register} errors={errors.creditCharges} />
                ) : null
              ) : type === 'customerLocations' ? (
                <CustomerLocationsField control={control} register={register} name={key} label={caption} />
              ) : type === 'customerServices' ? (
                <CustomerServicesField control={control} />
              ) : type === 'customerBilling' ? (
                <CustomerBillingField register={register} />
              ) : type === 'customerContacts' ? (
                <CustomerContactsField control={control} register={register} />
              ) : (
                <FormField
                  label={caption}
                  type={type || 'text'}
                  autoComplete={type === 'password' ? 'new-password' : undefined}
                  min={type === 'number' ? 0 : undefined}
                  step={type === 'number' ? 'any' : undefined}
                  {...register(key)}
                  error={valueAt(errors, key)?.message}
                />
              )}
              {key === 'branchId' && <small className="field-error">{errors[key]?.message}</small>}
            </div>
          ))}
        </div>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-footer">
          <button type="button" className="btn secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>
          <button className="btn" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Save ' + config.singular}
          </button>
        </div>
      </form>
    </Modal>
  );
}
