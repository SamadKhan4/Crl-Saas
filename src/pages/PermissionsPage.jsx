import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import Lookup from '../components/forms/Lookup';
import { idOf } from '../lib/workflow';
import { api, checkEnvelope } from '../api/client';
import { usersApi } from '../api/services';
import { errorMessage } from '../api/client';
import {
  DataTable,
  ErrorState,
  Loadingcrleleton,
  Modal,
  PageHeader,
} from '../components/common/UI';

const stageModules = {
  FM: ['BOOKING', 'LR', 'PICKUP'],
  MM: ['LR', 'HUB', 'SORTING', 'MANIFEST', 'LOADING', 'PTL', 'FTL', 'TRIP'],
  LM: ['LR', 'DELIVERY', 'POD'],
};
const modulesFor = (stages) => [...new Set(stages.flatMap((stage) => stageModules[stage]))];
const actions = ['VIEW', 'ADD', 'EDIT', 'DELETE', 'APPROVE', 'PRINT', 'EXPORT'];
export default function PermissionsPage() {
  const client = useQueryClient();
  const [employeeId, setEmployeeId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [stages, setStages] = useState([]);
  const [selected, setSelected] = useState(null),
    [matrix, setMatrix] = useState({});
  const query = useQuery({
    queryKey: ['users', 'permissions'],
    queryFn: () => usersApi.list({ limit: 100 }),
  });
  const save = useMutation({
    mutationFn: ({ id, permissions }) =>
      api
        .patch(`/users/${id}/operation-access`, { branchId, operationStages: stages, permissions })
        .then((r) => checkEnvelope(r.data)),
    onSuccess: () => {
      toast.success('Permissions updated');
      setSelected(null);
      client.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const edit = (row) => {
    setSelected(row);
    setBranchId(idOf(row.branchId) || '');
    setStages(row.operationStages ?? ['FM', 'MM', 'LM']);
    setMatrix(
      Object.fromEntries(
        modulesFor(['FM', 'MM', 'LM']).map((module) => [
          module,
          row.permissions?.length &&
          modulesFor(row.operationStages ?? ['FM', 'MM', 'LM']).includes(module)
            ? row.permissions.find((item) => item.module === module)?.actions || []
            : [...actions],
        ]),
      ),
    );
  };
  const modules = modulesFor(stages);
  const toggle = (module, action) =>
    setMatrix((current) => {
      const values = current[module] || [];
      return {
        ...current,
        [module]: values.includes(action)
          ? values.filter((value) => value !== action)
          : [...values, action],
      };
    });
  return (
    <>
      <PageHeader
        title="User Permissions"
        description="Select an employee, assign their branch and choose the operations they can access."
      />
      <section className="panel">
        <Lookup resource="users" label="Employee" value={employeeId} onChange={setEmployeeId} />
        <button
          className="btn"
          disabled={!employeeId}
          onClick={async () => {
            try {
              const result = await usersApi.detail(employeeId);
              edit(result.data);
            } catch (error) {
              toast.error(errorMessage(error));
            }
          }}
        >
          Configure selected employee
        </button>
      </section>
      <section className="panel">
        {query.isPending ? (
          <Loadingcrleleton />
        ) : query.isError ? (
          <ErrorState error={errorMessage(query.error)} retry={query.refetch} />
        ) : (
          <DataTable
            rows={query.data.data}
            columns={[
              { key: 'employeeCode', label: 'Code' },
              { key: 'name', label: 'User' },
              {
                key: 'branchId',
                label: 'Assigned branch',
                render: (r) => r.branchId?.name || '--',
              },
              {
                key: 'operationStages',
                label: 'Operations',
                render: (r) =>
                  r.operationStages === undefined
                    ? 'Role defaults'
                    : r.operationStages.join(', ') || 'No operations',
              },
              {
                key: 'permissions',
                label: 'Custom access',
                render: (r) =>
                  r.permissions?.length ? `${r.permissions.length} modules` : 'Role defaults',
              },
              {
                key: 'action',
                label: 'Action',
                render: (r) => (
                  <button className="text-btn" onClick={() => edit(r)}>
                    Configure
                  </button>
                ),
              },
            ]}
          />
        )}
      </section>
      {selected && (
        <Modal title={`Permissions · ${selected.name}`} onClose={() => setSelected(null)}>
          <Lookup
            resource="branches"
            label="Assigned branch"
            value={branchId}
            onChange={setBranchId}
          />
          <p>This employee can access operational data only for the assigned branch.</p>
          <div className="operation-permission-options">
            {[
              ['FM', 'First Mile'],
              ['MM', 'Middle Mile'],
              ['LM', 'Last Mile'],
            ].map(([value, label]) => (
              <label key={value}>
                <input
                  type="checkbox"
                  checked={stages.includes(value)}
                  onChange={() =>
                    setStages((current) =>
                      current.includes(value)
                        ? current.filter((stage) => stage !== value)
                        : [...current, value],
                    )
                  }
                />
                <strong>{label}</strong>
                <small>{value}</small>
              </label>
            ))}
          </div>
          <p>Selecting no operations disables operational access.</p>
          <h3>Operation module permissions</h3>
          <p>Only modules for the selected operations are shown.</p>
          <div className="permission-matrix">
            <div className="permission-head">
              <b>Module</b>
              {actions.map((action) => (
                <b key={action}>{action}</b>
              ))}
            </div>
            {modules.map((module) => (
              <div className="permission-row" key={module}>
                <strong>{module}</strong>
                {actions.map((action) => (
                  <label key={action}>
                    <input
                      type="checkbox"
                      aria-label={`${module} ${action}`}
                      checked={(matrix[module] || []).includes(action)}
                      onChange={() => toggle(module, action)}
                    />
                    <span>{action}</span>
                  </label>
                ))}
              </div>
            ))}
          </div>
          <div className="modal-footer">
            <button className="btn secondary" onClick={() => setSelected(null)}>
              Cancel
            </button>
            <button
              className="btn"
              disabled={save.isPending || !branchId}
              onClick={() =>
                save.mutate({
                  id: selected.id || selected._id,
                  permissions: modules.map((module) => ({ module, actions: matrix[module] || [] })),
                })
              }
            >
              Save permissions
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
