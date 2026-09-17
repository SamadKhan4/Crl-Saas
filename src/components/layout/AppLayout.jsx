import { useDispatch, useSelector } from 'react-redux';
import { toggleSidebar, expandSidebar } from '../../store';
import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Plus,
  Users,
  Building2,
  Files,
  ChartNoAxesCombined,
  History,
  Settings,
  Truck,
  PanelLeftClose,
  Menu,
  LogOut,
  ArrowUpRight,
  PackageCheck,
  X,
  ClipboardList,
  Route,
  MapPinned,
  ReceiptIndianRupee,
  FileText,
  Warehouse,
  HandCoins,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../features/auth/AuthContext';
import { errorMessage } from '../../api/client';
import { RouteErrorBoundary } from '../common/ErrorBoundary';
import { Suspense } from 'react';
import { Loadingcrleleton } from '../common/UI';
export function Brand() {
  return (
    <Link className="brand" to="/" aria-label={import.meta.env.VITE_APP_NAME || 'CRL Transport'}>
      <span className="brand-mark">
        <Truck size={25} />
      </span>
      <span>
        <b>
          CRL <span className="brand-dot">.</span>
        </b>
        <small>transport</small>
      </span>
    </Link>
  );
}
export default function AppLayout() {
  const { user, logout } = useAuth();
  const collapsed = useSelector((state) => state.workspace.sidebarCollapsed);
  const dispatch = useDispatch();
  const [mobile, setMobile] = useState(false),
    [busy, setBusy] = useState(false);
  const location = useLocation();
  const sidebarRef = useRef(null);
  useEffect(() => {
    if (!mobile) return;
    const previous = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const sidebar = sidebarRef.current;
    const items = () =>
      [...sidebar.querySelectorAll('a,button:not(:disabled)')].filter(
        (item) => item.getClientRects().length,
      );
    items()[0]?.focus();
    function keyboard(event) {
      if (event.key === 'Escape') setMobile(false);
      if (event.key !== 'Tab') return;
      const focusable = items(),
        first = focusable[0],
        last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    sidebar.addEventListener('keydown', keyboard);
    return () => {
      document.body.style.overflow = previousOverflow;
      sidebar.removeEventListener('keydown', keyboard);
      previous?.focus();
    };
  }, [mobile]);
  const base = `/${user.role.toLowerCase()}`;
  const admin = user.role === 'ADMIN';
  const manager = user.role === 'MANAGER';
  const navGroups = [
    { label: 'Overview', items: [['dashboard', 'Dashboard', LayoutDashboard]] },
    {
      label: 'Operations',
      items: [
        ['shipments', 'Booking Register', Package],
        ['shipments/create', 'Create LR', Plus],
        ['manifests', 'Manifest', ClipboardList],
        ['trips', 'Trips & Dispatch', Route],
        ['drs', 'Delivery Run Sheet', MapPinned],
        ...(!admin ? [['receive', 'Receive Parcel', PackageCheck]] : []),
        ['documents', 'POD & Documents', Files],
      ],
    },
    {
      label: 'Masters',
      items: [
        ['customers', 'Customer Master', Users],
        ...(admin
          ? [
              ['vendors', 'Vendor Master', Truck],
              ['branches', 'Branch Master', Building2],
              ['managers', 'Managers', Users],
              ['employees', 'Employees', Users],
            ]
          : manager
            ? [['employees', 'Employees', Users]]
            : []),
      ],
    },
    {
      label: 'Commercial',
      items:
        admin || manager
          ? [
              ['money-receipts', 'Money Receipts', ReceiptIndianRupee],
              ['invoices', 'Client Billing', FileText],
              ['receivables', 'Receivables', HandCoins],
              ['quotations', 'Quotations', FileText],
              ['stationery', 'Stationery', Warehouse],
            ]
          : [],
    },
    {
      label: 'Control',
      items: [
        ...(admin || manager ? [['reports', 'Reports & MIS', ChartNoAxesCombined]] : []),
        [
          admin ? 'audit' : 'activity',
          admin ? 'Team Activity' : manager ? 'Branch Activity' : 'My Activity',
          History,
        ],
        ...(admin || manager ? [['settings', 'Settings', Settings]] : []),
      ],
    },
  ].filter((group) => group.items.length);
  const items = navGroups.flatMap((group) => group.items);
  useEffect(() => {
    sidebarRef.current?.querySelector('nav a.active')?.scrollIntoView({ block: 'nearest' });
  }, [location.pathname]);
  const title =
    items.find((x) => location.pathname === `${base}/${x[0]}`)?.[1] || 'Shipment workspace';
  async function signOut() {
    setBusy(true);
    try {
      await logout();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={`app-shell ${collapsed ? 'collapsed' : ''}`}>
      <a className="crlip-link" href="#main-content">
        crlip to content
      </a>
      {mobile && (
        <button
          aria-label="Close navigation"
          className="drawer-backdrop"
          onClick={() => setMobile(false)}
        />
      )}
      <aside ref={sidebarRef} id="app-navigation" className={`sidebar ${mobile ? 'is-open' : ''}`}>
        <div className="sidebar-brand">
          <Brand />
          <button
            className="icon-btn mobile-only"
            aria-label="Close navigation"
            onClick={() => setMobile(false)}
          >
            <X size={20} />
          </button>
        </div>
        <div className="sidebar-scroll">
          <div className="workspace-pill">
            <span className="live-dot" />
            <span>
              {admin ? 'Administration' : manager ? 'Manager workspace' : 'Branch operations'}
            </span>
          </div>
          <nav aria-label="Main navigation">
            {navGroups.map((group) => (
              <section
                className="nav-group"
                key={group.label}
                aria-labelledby={`nav-${group.label}`}
              >
                <small className="nav-caption" id={`nav-${group.label}`}>
                  {group.label}
                </small>
                <div className="nav-group-links">
                  {group.items.map(([path, name, Icon]) => (
                    <NavLink
                      key={path}
                      to={`${base}/${path}`}
                      end={path === 'shipments'}
                      title={name}
                      onClick={() => setMobile(false)}
                    >
                      <Icon size={19} />
                      <span>{name}</span>
                      {path === 'shipments/create' && <small>+</small>}
                    </NavLink>
                  ))}
                </div>
              </section>
            ))}
          </nav>
        </div>
        <div className="sidebar-bottom">
          <Link to="/track">
            <ArrowUpRight size={17} />
            <span>Public tracking</span>
          </Link>
          <button onClick={() => dispatch(toggleSidebar())}>
            <PanelLeftClose size={18} />
            <span>Collapse sidebar</span>
          </button>
          <div className="sidebar-footer">
            CRL Transport Management<span>Built for the road ahead.</span>
          </div>
        </div>
      </aside>
      <div className="workspace" inert={mobile}>
        <header className="topbar">
          <div className="actions">
            <button
              className="icon-btn mobile-only"
              aria-label="Open navigation"
              aria-controls="app-navigation"
              aria-expanded={mobile}
              onClick={() => {
                dispatch(expandSidebar());
                setMobile(true);
              }}
            >
              <Menu />
            </button>
            <span className="breadcrumb">
              Workspace <span>/</span> <b>{title}</b>
            </span>
          </div>
          <div className="actions">
            <span className="header-date">
              {new Date().toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </span>
            <div className="avatar">{user.name?.slice(0, 2).toUpperCase()}</div>
            <div className="user-info">
              <strong>{user.name}</strong>
              <small>{admin ? 'Administrator' : manager ? 'Manager' : 'Employee'}</small>
            </div>
            <button
              className="icon-btn"
              title="Sign out"
              aria-label="Sign out"
              disabled={busy}
              onClick={signOut}
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>
        <main id="main-content">
          <RouteErrorBoundary>
            <Suspense fallback={<Loadingcrleleton />}>
              <Outlet />
            </Suspense>
          </RouteErrorBoundary>
        </main>
        <footer className="workspace-footer">
          <span>© {new Date().getFullYear()} CRL Transport</span>
          <span>Shipment & logistics workspace</span>
        </footer>
      </div>
    </div>
  );
}
