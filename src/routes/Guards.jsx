import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import { Loadingcrleleton } from '../components/common/UI';
export const roleHome = (role) =>
  role === 'EMPLOYEE' ? '/employee/shipments' : `/${String(role || '').toLowerCase()}/dashboard`;
export function ProtectedRoute({ role }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Loadingcrleleton />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (user.status !== 'ACTIVE' || !['ADMIN', 'MANAGER', 'EMPLOYEE'].includes(user.role))
    return <Navigate to="/login" replace />;
  if (role && user.role !== role)
    return <Navigate to={roleHome(user.role)} replace />;
  return <Outlet />;
}
export function HomeRoute() {
  const { user, loading } = useAuth();
  return loading ? (
    <Loadingcrleleton />
  ) : (
    <Navigate to={user ? roleHome(user.role) : '/login'} replace />
  );
}
export function PermissionGuard({ allowed, children }) {
  return allowed ? children : null;
}
