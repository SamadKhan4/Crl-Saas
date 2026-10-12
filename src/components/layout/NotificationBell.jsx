import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { get, errorMessage } from '../../api/client';

export default function NotificationBell({ user }) {
  const [open, setOpen] = useState(false);
  const container = useRef(null);
  const storageKey = `crl-notifications-seen:${user.id || user._id}`;
  const [seen, setSeen] = useState(() => {
    try { return localStorage.getItem(storageKey) || ''; } catch { return ''; }
  });
  const query = useQuery({
    queryKey: ['notification-outbox', 'header', user.id || user._id],
    queryFn: () => get('/notification-outbox', { limit: 20, sortBy: 'createdAt', sortOrder: 'desc' }),
    refetchInterval: 30000,
  });
  const notifications = query.data?.data || [];
  const latest = notifications.reduce((value, row) => row.createdAt > value ? row.createdAt : value, '');
  const unread = latest > seen;
  useEffect(() => {
    if (!open || !latest) return;
    setSeen(latest);
    try { localStorage.setItem(storageKey, latest); } catch { /* Browser storage may be unavailable. */ }
  }, [open, latest, storageKey]);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event) => {
      if (event.type === 'keydown' ? event.key === 'Escape' : !container.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', dismiss);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', dismiss);
    };
  }, [open]);
  return <div className="notification-bell" ref={container}>
    <button type="button" className="icon-btn notification-toggle" aria-label={unread ? 'Notifications, new notifications' : 'Notifications'} aria-expanded={open} aria-controls="header-notifications" onClick={() => setOpen((value) => !value)}>
      <Bell size={20} />
      {unread && <span className="notification-dot" />}
    </button>
    {open && <section id="header-notifications" className="notification-panel" aria-label="Notifications">
      <div className="notification-panel-heading"><strong>Notifications</strong><Link to={`/${user.role.toLowerCase()}/notifications`} onClick={() => setOpen(false)}>View all</Link></div>
      {query.isPending ? <p role="status">Loading notifications?</p> : query.isError ? <div><p role="alert">{errorMessage(query.error)}</p><button type="button" className="text-btn" onClick={() => query.refetch()}>Retry</button></div> : notifications.length ? <ul>{notifications.map((row) => <li key={row.id || row._id}>
        <strong>{row.subject}</strong>
        <p>{row.message}</p>
        <time dateTime={row.createdAt}>{new Date(row.createdAt).toLocaleString('en-IN')}</time>
      </li>)}</ul> : <p>No notifications yet.</p>}
    </section>}
  </div>;
}
