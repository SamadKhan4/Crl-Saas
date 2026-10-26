import { useDispatch, useSelector } from 'react-redux';
import { toggleSidebar, expandSidebar, selectOperationStage } from '../../store';
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
  FileCheck2,
  ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../features/auth/AuthContext';
import { errorMessage } from '../../api/client';
import { RouteErrorBoundary } from '../common/ErrorBoundary';
import { Suspense } from 'react';
import { Loadingcrleleton } from '../common/UI';
import NotificationBell from './NotificationBell';
import { misReports } from '../../lib/misReports';
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
  const storedOperationStage = useSelector((state) => state.workspace.operationStage);
  const allowedStages = user.role === 'EMPLOYEE' && Array.isArray(user.operationStages) ? user.operationStages : ['FM', 'MM', 'LM'];
  const operationStage = allowedStages.includes(storedOperationStage) ? storedOperationStage : user.role === 'EMPLOYEE' ? allowedStages[0] : storedOperationStage;
  const dispatch = useDispatch();
  const [mobile, setMobile] = useState(false),
    [busy, setBusy] = useState(false),
    [openMenus, setOpenMenus] = useState({});
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
  const page = location.pathname.split('/')[2];
  const stageForPage = { 'pickup-requests': 'FM', 'agent-alignment': 'FM', 'pickup-run-sheets': 'FM', segregations: 'MM', 'loading-tallies': 'MM', manifests: 'MM', trips: 'MM', 'last-mile-arrivals': 'LM', 'unloading-tallies': 'LM', drs: 'LM', 'drs-closure': 'LM', documents: 'LM', 'active-deliveries': 'LM' };
  const requiredStage = page === 'shipments' && location.pathname.endsWith('/create') ? 'FM' : stageForPage[page];
  const pageAllowed = user.role !== 'EMPLOYEE' || (!requiredStage ? page !== 'shipments' || allowedStages.length > 0 : allowedStages.includes(requiredStage));
  const base = `/${user.role.toLowerCase()}`;
  const admin = user.role === 'ADMIN';
  const manager = user.role === 'MANAGER';
  const hr = user.role === 'HR';
  const vendor = user.role === 'VENDOR';
  const hubItems = [
    ['segregations', 'City-wise Sorting', PackageCheck],
    ['loading-tallies', 'Loading Tally', HandCoins],
  ];
  const masterItems = admin || manager
    ? [
        ['customers', 'Customer Master', Users],
        ['branches', 'Branch Master', Building2],
        ['routes', 'Route Master', Route],
        ['locations', 'Location Master', MapPinned],
        ['fleet', 'Vehicle Master', Truck],
        ['vendors', 'Vendor Master', Truck],
        ...(admin ? [['managers', 'Manager Master', Users]] : []),
        ['employees', 'Employee Master', Users],
        ['hr-users', 'HR Master', Users],
        ['permissions', 'User Permission', Settings],
      ]
    : [];
  const operationItems =
    operationStage === 'FM'
      ? [
          ['pickup-requests', 'Pickup Request', PackageCheck],
          ['agent-alignment', 'Agent Alignment', Users],
          ['shipments/create', 'LR Entry', Plus],
          ['pickup-run-sheets', 'PRS Creation', ClipboardList],
        ]
      : operationStage === 'MM'
        ? [
            [
              'hub-management',
              'Route & Loading',
              Warehouse,
              false,
              hubItems.filter(([path]) => path !== 'pickups'),
            ],
            ['manifests', 'Manifest', ClipboardList],
            ['trips', 'Trip Creation & Dispatch', Route],
          ]
        : operationStage === 'LM'
          ? [
              ['last-mile-arrivals', 'Trip Arrival', PackageCheck],
              ['unloading-tallies', 'Trip Closure', ClipboardList],
              ['drs', 'Create DRS', MapPinned],
              ...(admin || manager ? [['drs-closure', 'DRS Closure', FileCheck2]] : []),
              ['documents', 'POD & Documents', Files],
              ['active-deliveries', 'Delivery Attempts', Truck],
            ]
          : [];
  const navGroups = (vendor ? [{ label: 'Vendor Workspace', items: [['portal', 'Vendor Portal', Truck], ['settings', 'Account Settings', Settings]] }] : hr ? [
    {
      label: 'Human Resources',
      items: [
        ['employees', 'Employee Onboarding', Users],
        ['attendance', 'Attendance', Users],
        ['holidays', 'Holiday Calendar', FileText],
        ['payslips', 'Payslips', FileText],
        ['settings', 'Account Settings', Settings],
      ],
    },
  ] : [
    { label: 'Overview', items: admin || manager ? [['dashboard', 'Dashboard', LayoutDashboard]] : [] },
    {
      label: 'Operations',
      items: operationItems.length ? [['operations', 'Operations', Truck, false, operationItems]] : [],
    },
    {
      label: 'Masters',
      items: masterItems.length
        ? [['masters', 'Masters', Building2, false, masterItems]]
        : [],
    },
    {
      label: 'Commercial',
      items:
        admin || manager
          ? [['commercial', 'Commercial', ReceiptIndianRupee, false, [
              ['invoices', 'Client Billing', FileText],
              ['vendor-settlements', 'Vendor Settlement', ReceiptIndianRupee],
              ['eway-gst', 'E-Way Bill', FileText],
              ['accounting', 'Accounting', ReceiptIndianRupee],
              ['quotations', 'Quotations', FileText],
              ['rate-engine', 'Rate Engine', HandCoins],
            ]]]
          : [],
    },
    {
      label: 'MIS & Reports',
      items: admin || manager ? [['mis-reports', 'MIS & Reports', ChartNoAxesCombined, false,
        misReports.map(([key, name]) => [`reports/${key}`, name, FileText]),
      ]] : [],
    },
    {
      label: 'Controls',
      items: admin || manager ? [['controls', 'Controls', Settings, false, [
        ['system-settings', 'Operational Settings', Settings],
        [admin ? 'audit' : 'activity', 'Team Activity', History],
        ['settings', 'Settings', Settings],
        ['claims', 'Claims / Damage', Package],
      ]]] : [],
    },
  ]).filter((group) => group.items.length);
  const flattenItems = (entries) => entries.flatMap((item) => item[4] ? flattenItems(item[4]) : [item]);
  const items = navGroups.flatMap((group) => flattenItems(group.items));
  const activeMenuPaths = [];
  const visitMenus = (entries) => entries.forEach(([path, , , , children]) => {
    if (!children) return;
    if (flattenItems(children).some(([childPath]) => (childPath.includes('?') ? `${location.pathname}${location.search}` === `${base}/${childPath}` : location.pathname === `${base}/${childPath}` || location.pathname.startsWith(`${base}/${childPath}/`)))) activeMenuPaths.push(path);
    visitMenus(children);
  });
  navGroups.forEach((group) => visitMenus(group.items));
  const activeMenuKey = activeMenuPaths.join(',');
  useEffect(() => {
    const activeMenus = Object.fromEntries(activeMenuKey.split(',').filter(Boolean).map((path) => [path, true]));
    setOpenMenus((current) => ({ ...current, ...activeMenus }));
  }, [activeMenuKey]);
  useEffect(() => {
    sidebarRef.current?.querySelector('nav a.active')?.scrollIntoView?.({ block: 'nearest' });
  }, [location.pathname]);
  const title =
    items.find((x) => `${location.pathname}${location.search}` === `${base}/${x[0]}` || location.pathname === `${base}/${x[0]}`)?.[1] || 'Shipment workspace';
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
  function renderNavItem([path, name, Icon, disabled, children]) {
                    if (children) {
                      const menuActive = flattenItems(children).some(([childPath]) => (childPath.includes('?') ? `${location.pathname}${location.search}` === `${base}/${childPath}` : location.pathname === `${base}/${childPath}` || location.pathname.startsWith(`${base}/${childPath}/`)));
                      const menuOpen = Boolean(openMenus[path]);
                      return (
                        <div className={`nav-dropdown ${menuActive ? 'is-active' : ''}`} key={path}>
                          <button
                            type="button"
                            className="nav-dropdown-toggle"
                            aria-expanded={menuOpen}
                            onClick={() => {
                              if (collapsed) dispatch(expandSidebar());
                              setOpenMenus((current) => ({ ...current, [path]: !current[path] }));
                            }}
                          >
                            <Icon size={19} />
                            <span>{name}</span>
                            <ChevronDown className={menuOpen ? 'is-open' : ''} size={16} />
                          </button>
                          {menuOpen && (
                            <div className="nav-submenu">
                              {children.map(renderNavItem)}
                            </div>
                          )}
                        </div>
                      );
                    }
                    return disabled ? (
                      <button key={path} type="button" className="nav-disabled" disabled title={`${name} · Coming soon`}>
                        <Icon size={19} />
                        <span>{name}</span>
                        <small>Soon</small>
                      </button>
                    ) : (
                      <NavLink key={path} to={`${base}/${path}`} className={path.includes('?') ? (`${location.pathname}${location.search}` === `${base}/${path}` ? 'active' : '') : undefined} end={path === 'shipments'} title={name} onClick={() => setMobile(false)}>
                        <Icon size={19} />
                        <span>{name}</span>
                        {path === 'shipments/create' && <small>+</small>}
                      </NavLink>
                    );

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
              {admin ? 'Administration' : manager ? 'Manager workspace' : 'Operations'}
            </span>
          </div>
          <nav aria-label="Main navigation">
            {user.role === 'EMPLOYEE' && allowedStages.length > 0 && <label className="employee-stage-selector">Operations<select aria-label="Operation stage" value={operationStage || ''} onChange={(event) => dispatch(selectOperationStage(event.target.value))}>{allowedStages.map((stage) => <option key={stage} value={stage}>{({ FM: 'First Mile', MM: 'Middle Mile', LM: 'Last Mile' })[stage]}</option>)}</select></label>}
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
                  {group.items.map(renderNavItem)}
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
            {(admin || manager) && <NotificationBell key={user.id || user._id} user={user} />}
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
              <>{pageAllowed ? <Outlet /> : <section className="panel"><h2>Operation access required</h2><p>This operation has not been assigned to your employee account.</p></section>}</>
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
