import { lazy, Suspense } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import { ProtectedRoute, HomeRoute } from './routes/Guards';
import AppLayout from './components/layout/AppLayout';
import { Loadingcrleleton, EmptyState } from './components/common/UI';
import { RouteErrorBoundary } from './components/common/ErrorBoundary';
const Login = lazy(() => import('./pages/LoginPage'));
const Dashboard = lazy(() => import('./pages/DashboardPage'));
const Shipments = lazy(() => import('./pages/ShipmentsPage'));
const CreateLR = lazy(() => import('./pages/CreateLRPage'));
const ShipmentDetail = lazy(() => import('./pages/ShipmentDetailPage'));
const Management = lazy(() => import('./pages/ManagementPage'));
const CustomerDetail = lazy(() => import('./pages/CustomerDetailPage'));
const Documents = lazy(() => import('./pages/DocumentsPage'));
const Reports = lazy(() => import('./pages/ReportsPage'));
const Activity = lazy(() => import('./pages/ActivityPage'));
const Settings = lazy(() => import('./pages/SettingsPage'));
const Receive = lazy(() => import('./pages/ReceivePage'));
const Public = lazy(() => import('./pages/PublicPage'));
const RequestUpload = lazy(() =>
  import('./pages/PublicPage').then((m) => ({ default: m.RequestUploadPage })),
);
const PublicQuotation = lazy(() => import('./pages/PublicQuotationPage'));
const TmsModule = lazy(() => import('./pages/TmsModulePage'));
const DrsWorkspace = lazy(() => import('./pages/DrsWorkspacePage'));
const Receivables = lazy(() => import('./pages/ReceivablesPage'));
export default function App() {
  return (
    <RouteErrorBoundary>
      <Suspense fallback={<Loadingcrleleton />}>
        <Routes>
          <Route path="/" element={<HomeRoute />} />
          <Route path="/login" element={<Login />} />
          <Route path="/track" element={<Public />} />
          <Route path="/upload-lr/:token" element={<Public />} />
          <Route path="/request-upload" element={<RequestUpload />} />
          <Route path="/get-quotation" element={<PublicQuotation />} />
          {['ADMIN', 'MANAGER', 'EMPLOYEE'].map((role) => (
            <Route key={role} element={<ProtectedRoute role={role} />}>
              <Route path={`/${role.toLowerCase()}`} element={<AppLayout />}>
                <Route index element={<HomeRoute />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="shipments" element={<Shipments />} />
                <Route path="shipments/create" element={<CreateLR />} />
                <Route path="shipments/:id" element={<ShipmentDetail />} />
                <Route path="customers" element={<Management />} />
                <Route path="customers/:id" element={<CustomerDetail />} />
                <Route path="documents" element={<Documents />} />
                <Route path="manifests" element={<TmsModule />} />
                <Route path="trips" element={<TmsModule />} />
                <Route path="drs" element={<TmsModule />} />
                <Route path="drs/:id" element={<DrsWorkspace />} />
                {role === 'MANAGER' && (
                  <>
                    <Route path="employees" element={<Management />} />
                    <Route path="reports" element={<Reports />} />
                    <Route path="settings" element={<Settings />} />
                    <Route path="money-receipts" element={<TmsModule />} />
                    <Route path="invoices" element={<TmsModule />} />
                    <Route path="quotations" element={<TmsModule />} />
                    <Route path="stationery" element={<TmsModule />} />
                    <Route path="receivables" element={<Receivables />} />
                  </>
                )}
                {role === 'ADMIN' ? (
                  <>
                    <Route path="managers" element={<Management />} />
                    <Route path="employees" element={<Management />} />
                    <Route path="branches" element={<Management />} />
                    <Route path="reports" element={<Reports />} />
                    <Route path="audit" element={<Activity />} />
                    <Route path="settings" element={<Settings />} />
                    <Route path="vendors" element={<TmsModule />} />
                    <Route path="money-receipts" element={<TmsModule />} />
                    <Route path="invoices" element={<TmsModule />} />
                    <Route path="quotations" element={<TmsModule />} />
                    <Route path="stationery" element={<TmsModule />} />
                    <Route path="receivables" element={<Receivables />} />
                  </>
                ) : (
                  <>
                    <Route path="receive" element={<Receive />} />
                    <Route path="activity" element={<Activity />} />
                  </>
                )}
              </Route>
            </Route>
          ))}
          <Route
            path="*"
            element={
              <EmptyState
                title="Page not found"
                description="This page does not exist or is not available for your role."
              >
                <Link className="btn" to="/">
                  Return to workspace
                </Link>
              </EmptyState>
            }
          />
        </Routes>
      </Suspense>
    </RouteErrorBoundary>
  );
}
