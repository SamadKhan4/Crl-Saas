import { useEffect, useRef } from 'react';
import { PackageOpen, AlertCircle, ArrowUpDown, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { label, date, statuses, idOf } from '../../lib/workflow';
export function PageHeader({ title, description, children }) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">crl  / OPERATIONS</div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      <div className="actions">{children}</div>
    </div>
  );
}
export function StatusBadge({ status }) {
  return (
    <span className={`badge status-${status}`}>
      <span />
      {label(status) || 'Unknown'}
    </span>
  );
}
export function Loadingcrleleton() {
  return (
    <div aria-label="Loading" role="status" className="crleleton-grid">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div className="crleleton" key={i} />
      ))}
    </div>
  );
}
export function EmptyState({
  title = 'No records found',
  description = 'Try adjusting your filters.',
  children,
}) {
  return (
    <div className="empty">
      <PackageOpen size={38} />
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  );
}
export function ErrorState({ error, retry }) {
  return (
    <div className="empty" role="alert">
      <AlertCircle size={32} />
      <h3>Unable to load this information</h3>
      <p>{error}</p>
      {retry && (
        <button className="btn" onClick={retry}>
          Try again
        </button>
      )}
    </div>
  );
}
export function StatCard({ label: caption, value, icon: Icon, detail }) {
  return (
    <article className="stat-card">
      <div className="stat-top">
        <span>{caption}</span>
        {Icon && <Icon size={19} />}
      </div>
      <strong>{value ?? '—'}</strong>
      {detail && <small>{detail}</small>}
    </article>
  );
}
export function FormField({ label: caption, error, children, ...props }) {
  const id = props.id || props.name;
  return (
    <div className="field">
      <label htmlFor={id}>{caption}</label>
      {children || (
        <input
          id={id}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          {...props}
        />
      )}{' '}
      {error && (
        <small id={`${id}-error`} className="field-error" role="alert">
          {error}
        </small>
      )}
    </div>
  );
}
export function Modal({ title, children, onClose }) {
  const ref = useRef();
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      aria-labelledby="modal-title"
    >
      <div className="modal-heading">
        <h2 id="modal-title">{title}</h2>
        <button className="icon-btn" aria-label="Close dialog" onClick={onClose}>
          <X />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function ConfirmDialog({
  title,
  description,
  onConfirm,
  onClose,
  pending,
  children,
  error,
}) {
  return (
    <Modal title={title} onClose={() => !pending && onClose()}>
      <p>{description}</p>
      {children}
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      <div className="modal-footer">
        <button className="btn secondary" disabled={pending} onClick={onClose}>
          Cancel
        </button>
        <button className="btn" disabled={pending} onClick={onConfirm}>
          {pending ? 'Saving…' : 'Confirm'}
        </button>
      </div>
    </Modal>
  );
}
export function Pagination({ pagination, onPage }) {
  if (!pagination) return null;
  const { page = 1, total = 0, limit = 20 } = pagination,
    pages = pagination.totalPages ?? pagination.pages ?? 1;
  return (
    <div className="pagination">
      <span>
        {total
          ? `${(page - 1) * limit + 1}–${Math.min(page * limit, total)} of ${total}`
          : '0 records'}
      </span>
      <div className="actions">
        <button
          className="icon-btn"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          <ChevronLeft size={18} />
        </button>
        <span>
          Page {page} of {Math.max(1, pages)}
        </span>
        <button
          className="icon-btn"
          aria-label="Next page"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
export function DataTable({
  columns,
  rows = [],
  pagination,
  onPage,
  onSort,
  empty = 'No records found',
}) {
  if (!Array.isArray(rows))
    return <ErrorState error="The list could not be displayed. Refresh this page to try again." />;
  if (!rows.length)
    return (
      <>
        <EmptyState title={empty} />
        <Pagination pagination={pagination} onPage={onPage} />
      </>
    );
  return (
    <>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key}>
                  {c.sort && onSort ? (
                    <button onClick={() => onSort(c.sort)}>
                      {c.label}
                      <ArrowUpDown size={13} />
                    </button>
                  ) : (
                    c.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={idOf(row) || i}>
                {columns.map((c) => (
                  <td key={c.key} data-label={c.label}>
                    {c.render ? c.render(row) : (row[c.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination pagination={pagination} onPage={onPage} />
    </>
  );
}
export function ShipmentTimeline({ status }) {
  const active = statuses.indexOf(status);
  return (
    <ol className="shipment-timeline" aria-label="Shipment progress">
      {statuses.slice(0, -1).map((step, i) => (
        <li
          key={step}
          className={status === 'CANCELLED' ? '' : i <= active ? 'done' : ''}
          aria-current={i === active ? 'step' : undefined}
        >
          <span>{i + 1}</span>
          <small>{label(step)}</small>
        </li>
      ))}
    </ol>
  );
}
export function ActivityTimeline({ events = [] }) {
  return events.length ? (
    <ol className="activity-timeline">
      {events.map((event, i) => (
        <li key={event.id || i}>
          <StatusBadge status={event.status} />
          <strong>{event.location}</strong>
          <p>{event.remarks}</p>
          <small>{date(event.timestamp || event.createdAt)}</small>
        </li>
      ))}
    </ol>
  ) : (
    <EmptyState
      title="No tracking events yet"
      description="Recorded shipment events will appear here."
    />
  );
}
