import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Plus, UploadCloud } from 'lucide-react';
import { toast } from 'sonner';
import { onboardingApi } from '../api/services';
import { errorMessage, formErrors } from '../api/client';
import { employeeOnboardingSchema } from '../schemas';
import { useList } from '../hooks/useList';
import { useAuth } from '../features/auth/AuthContext';
import { date, idOf, validateFile } from '../lib/workflow';
import Lookup from '../components/forms/Lookup';
import SearchInput from '../components/forms/SearchInput';
import {
  DataTable, ErrorState, FormField, Loadingcrleleton, Modal, PageHeader, StatusBadge,
} from '../components/common/UI';

const today = () => new Date().toLocaleDateString('en-CA');
const documentTypes = [['ID_PROOF', 'ID proof'], ['ADDRESS_PROOF', 'Address proof'], ['PHOTO', 'Photo'], ['EDUCATION', 'Education'], ['OTHER', 'Other']];

async function downloadDocument(record, fileDocument) {
  try {
    const response = await onboardingApi.download(idOf(record), idOf(fileDocument));
    const url = URL.createObjectURL(response.data);
    const link = window.document.createElement('a');
    link.href = url;
    link.download = fileDocument.originalFileName || 'employee-document';
    window.document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (error) {
    toast.error(errorMessage(error));
  }
}

function DocumentUploader({ record, onClose }) {
  const cache = useQueryClient();
  const [documentType, setDocumentType] = useState('ID_PROOF');
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function upload() {
    const invalid = validateFile(file);
    if (invalid) return setError(invalid);
    setBusy(true);
    setError('');
    try {
      const body = new FormData();
      body.append('document', file);
      await onboardingApi.upload(idOf(record), documentType, body);
      cache.invalidateQueries({ queryKey: ['employee-onboarding'] });
      toast.success('Employee document uploaded');
      onClose();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }
  return <Modal title={`Documents · ${record.name}`} onClose={() => !busy && onClose()}>
    <div className="form-grid">
      <div className="field"><label>Document type<select value={documentType} onChange={(event) => setDocumentType(event.target.value)}>{documentTypes.map(([value, caption]) => <option key={value} value={value}>{caption}</option>)}</select></label></div>
      <div className="field"><label>Select file<input type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" onChange={(event) => setFile(event.target.files?.[0] || null)} /></label></div>
    </div>
    <small>JPG, PNG, WEBP or PDF · Maximum 10 MB. Uploading the same type replaces the previous file.</small>
    {error && <p className="field-error" role="alert">{error}</p>}
    <div className="modal-footer"><button className="btn secondary" type="button" onClick={onClose}>Cancel</button><button className="btn" type="button" disabled={!file || busy} onClick={upload}><UploadCloud size={16} /> {busy ? 'Uploading…' : 'Upload document'}</button></div>
  </Modal>;
}

function OnboardingEditor({ onClose, onCreated }) {
  const [serverError, setServerError] = useState('');
  const { register, control, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(employeeOnboardingSchema),
    defaultValues: { name: '', email: '', mobile: '', alternateMobile: '', dateOfBirth: '', joiningDate: today(), designation: '', department: '', branchId: '', address: '', city: '', state: '', pincode: '', emergencyContactName: '', emergencyContactMobile: '', panNumber: '', aadhaarLast4: '' },
  });
  async function save(values) {
    setServerError('');
    try {
      const response = await onboardingApi.create(values);
      toast.success('Employee information submitted for manager approval');
      onCreated(response.data);
    } catch (error) {
      setServerError(errorMessage(error));
      formErrors(error, setError);
    }
  }
  const fields = [
    ['name', 'Full name'], ['email', 'Personal email', 'email'], ['mobile', 'Mobile'], ['alternateMobile', 'Alternate mobile'],
    ['dateOfBirth', 'Date of birth', 'date'], ['joiningDate', 'Joining date', 'date'], ['designation', 'Designation'], ['department', 'Department'],
    ['address', 'Address'], ['city', 'City'], ['state', 'State'], ['pincode', 'Pincode'],
    ['emergencyContactName', 'Emergency contact name'], ['emergencyContactMobile', 'Emergency contact mobile'], ['panNumber', 'PAN number'], ['aadhaarLast4', 'Aadhaar last 4 digits'],
  ];
  return <Modal title="Employee onboarding" onClose={() => !isSubmitting && onClose()}>
    <form onSubmit={handleSubmit(save)}>
      <div className="form-grid">
        {fields.map(([name, caption, type]) => <FormField key={name} label={caption} type={type || 'text'} {...register(name)} error={errors[name]?.message} />)}
        <Controller name="branchId" control={control} render={({ field }) => <Lookup resource="branches" branchOptions label="Joining branch" {...field} />} />
      </div>
      <p className="form-note">Login ID and password are not created here. The manager will verify documents and create login access.</p>
      {serverError && <p className="field-error" role="alert">{serverError}</p>}
      <div className="modal-footer"><button type="button" className="btn secondary" onClick={onClose}>Cancel</button><button className="btn" disabled={isSubmitting}>{isSubmitting ? 'Submitting…' : 'Save information'}</button></div>
    </form>
  </Modal>;
}

function ReviewModal({ record, onClose }) {
  const cache = useQueryClient();
  const [action, setAction] = useState('APPROVE');
  const [password, setPassword] = useState('');
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState('');
  const mutation = useMutation({
    mutationFn: () => onboardingApi.review(idOf(record), { action, ...(action === 'APPROVE' && { password }), ...(remarks && { remarks }) }),
    onSuccess: (response) => {
      cache.invalidateQueries({ queryKey: ['employee-onboarding'] });
      cache.invalidateQueries({ queryKey: ['users'] });
      toast.success(action === 'APPROVE' ? `Login created: ${response.data.employee.employeeCode}` : 'Onboarding rejected');
      onClose();
    },
    onError: (reason) => setError(errorMessage(reason)),
  });
  return <Modal title={`Manager review · ${record.name}`} onClose={() => !mutation.isPending && onClose()}>
    <div className="onboarding-documents"><b>Submitted documents</b>{record.documents?.length ? record.documents.map((item) => <button type="button" className="text-btn" key={idOf(item)} onClick={() => downloadDocument(record, item)}><FileText size={15} /> {item.documentType.replaceAll('_', ' ')} · {item.originalFileName}</button>) : <small>No documents uploaded.</small>}</div>
    <div className="form-grid">
      <div className="field"><label>Decision<select value={action} onChange={(event) => setAction(event.target.value)}><option value="APPROVE">Approve and create login</option><option value="REJECT">Reject</option></select></label></div>
      {action === 'APPROVE' && <FormField label="Initial login password" type="password" minLength="12" value={password} onChange={(event) => setPassword(event.target.value)} />}
      <div className="field tms-span-2"><label>Manager remarks<textarea value={remarks} onChange={(event) => setRemarks(event.target.value)} /></label></div>
    </div>
    {error && <p className="field-error" role="alert">{error}</p>}
    <div className="modal-footer"><button className="btn secondary" type="button" onClick={onClose}>Cancel</button><button className="btn" type="button" disabled={mutation.isPending || (action === 'APPROVE' && password.length < 12) || (action === 'REJECT' && !remarks.trim())} onClick={() => mutation.mutate()}>{mutation.isPending ? 'Saving…' : action === 'APPROVE' ? 'Create employee login' : 'Reject onboarding'}</button></div>
  </Modal>;
}

export default function EmployeeOnboardingPage() {
  const { user } = useAuth();
  const service = onboardingApi;
  const { query, filters, update, clear, sort } = useList('employee-onboarding', service);
  const cache = useQueryClient();
  const [editor, setEditor] = useState(false);
  const [documents, setDocuments] = useState(null);
  const [review, setReview] = useState(null);
  const isHr = user.role === 'HR';
  const columns = [
    { key: 'onboardingNumber', label: 'Onboarding', render: (row) => <strong>{row.onboardingNumber}</strong> },
    { key: 'name', label: 'Employee', sort: 'name', render: (row) => <div><strong>{row.name}</strong><small className="tms-table-subtitle">{row.email} · {row.mobile}</small></div> },
    { key: 'branchId', label: 'Branch', render: (row) => row.branchId?.name || '—' },
    { key: 'designation', label: 'Role', render: (row) => `${row.designation} · ${row.department}` },
    { key: 'documents', label: 'Documents', render: (row) => `${row.documents?.length || 0} uploaded` },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'createdAt', label: 'Submitted', render: (row) => date(row.createdAt) },
    { key: 'actions', label: 'Actions', render: (row) => <div className="row-actions">{isHr && row.status === 'PENDING_MANAGER' && <button className="text-btn" onClick={() => setDocuments(row)}>Add documents</button>}{!isHr && row.status === 'PENDING_MANAGER' && <button className="text-btn" onClick={() => setReview(row)}>Review & create login</button>}{row.documents?.map((item) => <button className="text-btn" key={idOf(item)} onClick={() => downloadDocument(row, item)}>{item.documentType.replaceAll('_', ' ')}</button>)}</div> },
  ];
  return <>
    <PageHeader title={isHr ? 'Employee Onboarding' : 'Onboarding Approval'} description={isHr ? 'Collect employee information and documents for manager approval.' : 'Verify documents, set the initial password and create employee login access.'}>
      {isHr && <button className="btn" onClick={() => setEditor(true)}><Plus size={17} /> Onboard employee</button>}
    </PageHeader>
    <section className="panel"><div className="filter-bar"><SearchInput value={filters.search || ''} onChange={(value) => update('search', value)} /><select value={filters.status || ''} onChange={(event) => update('status', event.target.value)}><option value="">All statuses</option><option value="PENDING_MANAGER">Pending manager</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option></select><button className="text-btn" onClick={clear}>Clear filters</button></div>{query.isPending ? <Loadingcrleleton /> : query.isError ? <ErrorState error={errorMessage(query.error)} retry={query.refetch} /> : <DataTable rows={query.data.data} columns={columns} pagination={query.data.pagination} onPage={(page) => update('page', page)} onSort={sort} />}</section>
    {editor && <OnboardingEditor onClose={() => setEditor(false)} onCreated={(record) => { setEditor(false); setDocuments(record); cache.invalidateQueries({ queryKey: ['employee-onboarding'] }); }} />}
    {documents && <DocumentUploader record={documents} onClose={() => setDocuments(null)} />}
    {review && <ReviewModal record={review} onClose={() => setReview(null)} />}
  </>;
}
