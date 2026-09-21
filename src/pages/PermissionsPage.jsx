import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { usersApi } from '../api/services';
import { errorMessage } from '../api/client';
import { DataTable, ErrorState, Loadingcrleleton, Modal, PageHeader } from '../components/common/UI';

const modules = ['BOOKING', 'LR', 'PICKUP', 'HUB', 'SORTING', 'MANIFEST', 'LOADING', 'PTL', 'FTL', 'TRIP', 'DELIVERY', 'POD', 'CUSTOMER', 'VENDOR', 'FLEET', 'DRIVER', 'RATE', 'BILLING', 'RECEIPT', 'SETTLEMENT', 'EWAY', 'ACCOUNTING', 'CLAIM', 'REPORT', 'HR'];
const actions = ['VIEW', 'ADD', 'EDIT', 'DELETE', 'APPROVE', 'PRINT', 'EXPORT'];
export default function PermissionsPage() {
  const client = useQueryClient();
  const [selected, setSelected] = useState(null), [matrix, setMatrix] = useState({});
  const query = useQuery({ queryKey: ['users', 'permissions'], queryFn: () => usersApi.list({ limit: 100 }) });
  const save = useMutation({ mutationFn: ({ id, permissions }) => usersApi.update(id, { permissions }), onSuccess: () => { toast.success('Permissions updated'); setSelected(null); client.invalidateQueries({ queryKey: ['users'] }); }, onError: (error) => toast.error(errorMessage(error)) });
  const edit = (row) => { setSelected(row); setMatrix(Object.fromEntries((row.permissions || []).map((item) => [item.module, item.actions]))); };
  const toggle = (module, action) => setMatrix((current) => { const values = current[module] || []; return { ...current, [module]: values.includes(action) ? values.filter((value) => value !== action) : [...values, action] }; });
  return <><PageHeader title="User Permissions" description="Backend-enforced module permissions for view, add, edit, delete, approve, print and export." />
    <section className="panel">{query.isPending ? <Loadingcrleleton /> : query.isError ? <ErrorState error={errorMessage(query.error)} retry={query.refetch} /> : <DataTable rows={query.data.data} columns={[{ key: 'employeeCode', label: 'Code' }, { key: 'name', label: 'User' }, { key: 'role', label: 'Role' }, { key: 'permissions', label: 'Custom access', render: (r) => r.permissions?.length ? `${r.permissions.length} modules` : 'Role defaults' }, { key: 'action', label: 'Action', render: (r) => <button className="text-btn" onClick={() => edit(r)}>Configure</button> }]} />}</section>
    {selected && <Modal title={`Permissions · ${selected.name}`} onClose={() => setSelected(null)}><p>Leaving every module empty restores role-default access.</p><div className="permission-matrix"><div className="permission-head"><b>Module</b>{actions.map((action) => <b key={action}>{action}</b>)}</div>{modules.map((module) => <div className="permission-row" key={module}><strong>{module}</strong>{actions.map((action) => <label key={action}><input type="checkbox" checked={(matrix[module] || []).includes(action)} onChange={() => toggle(module, action)} /><span>{action}</span></label>)}</div>)}</div><div className="modal-footer"><button className="btn secondary" onClick={() => setSelected(null)}>Cancel</button><button className="btn" disabled={save.isPending} onClick={() => save.mutate({ id: selected.id || selected._id, permissions: Object.entries(matrix).filter(([, values]) => values.length).map(([module, values]) => ({ module, actions: values })) })}>Save permissions</button></div></Modal>}
  </>;
}
