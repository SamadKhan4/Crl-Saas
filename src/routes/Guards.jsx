import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import { Loadingcrleleton } from '../components/common/UI';
export function ProtectedRoute({ role }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Loadingcrleleton />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (user.status !== 'ACTIVE' || !['ADMIN', 'MANAGER', 'EMPLOYEE'].includes(user.role))
    return <Navigate to="/login" replace />;
  if (role && user.role !== role)
    return <Navigate to={`/${user.role.toLowerCase()}/dashboard`} replace />;
  return <Outlet />;
}
export function HomeRoute() {
  const { user, loading } = useAuth();
  return loading ? (
    <Loadingcrleleton />
  ) : (
    <Navigate to={user ? `/${user.role.toLowerCase()}/dashboard` : '/login'} replace />
  );
}
export function PermissionGuard({ allowed, children }) {
  return allowed ? children : null;
}
