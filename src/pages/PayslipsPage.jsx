import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { payslipsApi } from '../api/services';
import { errorMessage, formErrors } from '../api/client';
import { payslipSchema } from '../schemas';
import { useList } from '../hooks/useList';
import { date, idOf } from '../lib/workflow';
import Lookup from '../components/forms/Lookup';
import SearchInput from '../components/forms/SearchInput';
import {
  DataTable, ErrorState, FormField, Loadingcrleleton, Modal, PageHeader, StatusBadge,
} from '../components/common/UI';

const money = (value) => `₹ ${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const emptyParts = { basic: 0, hra: 0, conveyance: 0, allowance: 0, bonus: 0, other: 0 };
const emptyDeductions = { pf: 0, esi: 0, professionalTax: 0, tds: 0, advance: 0, other: 0 };
const currentMonth = new Date().toLocaleDateString('en-CA').slice(0, 7);

function PayslipEditor({ onClose }) {
  const cache = useQueryClient();
  const [serverError, setServerError] = useState('');
  const { register, control, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(payslipSchema),
    defaultValues: {
      employeeId: '', salaryMonth: currentMonth, designation: '', department: '', paidDays: 30,
      earnings: emptyParts, deductions: emptyDeductions, paymentDate: '', paymentReference: '', notes: '',
    },
  });
  async function save(values) {
    setServerError('');
    try {
      await payslipsApi.create(values);
      cache.invalidateQueries({ queryKey: ['payslips'] });
      toast.success('Payslip created');
      onClose();
    } catch (error) {
      setServerError(errorMessage(error));
      formErrors(error, setError);
    }
  }
  const salaryField = (group, name, caption) => (
    <FormField key={`${group}.${name}`} label={caption} type="number" min="0" step="0.01"
      {...register(`${group}.${name}`)} error={errors[group]?.[name]?.message} />
  );
  return (
    <Modal title="Create employee payslip" onClose={() => !isSubmitting && onClose()}>
      <form onSubmit={handleSubmit(save)}>
        <div className="form-grid">
          <Controller name="employeeId" control={control} render={({ field }) => (
            <Lookup resource="users" label="Employee" {...field} />
          )} />
          <FormField label="Salary month" type="month" {...register('salaryMonth')} error={errors.salaryMonth?.message} />
          <FormField label="Designation" {...register('designation')} error={errors.designation?.message} />
          <FormField label="Department" {...register('department')} error={errors.department?.message} />
          <FormField label="Paid days" type="number" min="0" max="31" step="0.5" {...register('paidDays')} error={errors.paidDays?.message} />
          <FormField label="Payment date" type="date" {...register('paymentDate')} error={errors.paymentDate?.message} />
        </div>
        <h3 className="form-subheading">Earnings</h3>
        <div className="form-grid">
          {salaryField('earnings', 'basic', 'Basic salary')}
          {salaryField('earnings', 'hra', 'HRA')}
          {salaryField('earnings', 'conveyance', 'Conveyance')}
          {salaryField('earnings', 'allowance', 'Special allowance')}
          {salaryField('earnings', 'bonus', 'Bonus / incentive')}
          {salaryField('earnings', 'other', 'Other earnings')}
        </div>
        <h3 className="form-subheading">Deductions</h3>
        <div className="form-grid">
          {salaryField('deductions', 'pf', 'Provident fund')}
          {salaryField('deductions', 'esi', 'ESI')}
          {salaryField('deductions', 'professionalTax', 'Professional tax')}
          {salaryField('deductions', 'tds', 'TDS')}
          {salaryField('deductions', 'advance', 'Advance / loan')}
          {salaryField('deductions', 'other', 'Other deductions')}
          <FormField label="Payment reference" {...register('paymentReference')} error={errors.paymentReference?.message} />
          <div className="field tms-span-2"><label>Notes<textarea {...register('notes')} /></label></div>
        </div>
        {serverError && <p className="field-error" role="alert">{serverError}</p>}
        <div className="modal-footer">
          <button type="button" className="btn secondary" onClick={onClose} disabled={isSubmitting}>Cancel</button>
          <button className="btn" disabled={isSubmitting}>{isSubmitting ? 'Creating…' : 'Create payslip'}</button>
        </div>
      </form>
    </Modal>
  );
}

export default function PayslipsPage() {
  const { query, filters, update, clear, sort } = useList('payslips', payslipsApi);
  const cache = useQueryClient();
  const [create, setCreate] = useState(false);
  const issue = useMutation({
    mutationFn: (id) => payslipsApi.status(id, 'ISSUED'),
    onSuccess: () => { cache.invalidateQueries({ queryKey: ['payslips'] }); toast.success('Payslip issued'); },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const columns = [
    { key: 'payslipNumber', label: 'Payslip', render: (row) => <strong>{row.payslipNumber}</strong> },
    { key: 'employee', label: 'Employee', render: (row) => <div><strong>{row.employeeId?.name}</strong><small className="tms-table-subtitle">{row.employeeId?.employeeCode}</small></div> },
    { key: 'salaryMonth', label: 'Month', sort: 'salaryMonth' },
    { key: 'netPay', label: 'Net Pay', render: (row) => money(row.netPay) },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'createdAt', label: 'Created', render: (row) => date(row.createdAt) },
    { key: 'actions', label: 'Actions', render: (row) => <div className="row-actions"><Link className="text-btn" to={`${idOf(row)}`}>View / Download</Link>{row.status === 'DRAFT' && <button className="text-btn" disabled={issue.isPending} onClick={() => issue.mutate(idOf(row))}>Issue</button>}</div> },
  ];
  return <>
    <PageHeader title="Payslips" description="Create, issue, print and download employee salary slips.">
      <button className="btn" onClick={() => setCreate(true)}><Plus size={17} /> Create payslip</button>
    </PageHeader>
    <section className="panel">
      <div className="filter-bar"><SearchInput value={filters.search || ''} onChange={(value) => update('search', value)} /><input type="month" aria-label="Salary month" value={filters.salaryMonth || ''} onChange={(event) => update('salaryMonth', event.target.value)} /><button className="text-btn" onClick={clear}>Clear filters</button></div>
      {query.isPending ? <Loadingcrleleton /> : query.isError ? <ErrorState error={errorMessage(query.error)} retry={query.refetch} /> : <DataTable rows={query.data.data} columns={columns} pagination={query.data.pagination} onPage={(page) => update('page', page)} onSort={sort} />}
    </section>
    {create && <PayslipEditor onClose={() => setCreate(false)} />}
  </>;
}
