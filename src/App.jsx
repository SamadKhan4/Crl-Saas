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
const DrsClosure = lazy(() => import('./pages/DrsClosurePage'));
const TmsPrint = lazy(() => import('./pages/TmsPrintPage'));
const Receivables = lazy(() => import('./pages/ReceivablesPage'));
const Payslips = lazy(() => import('./pages/PayslipsPage'));
const PayslipDetail = lazy(() => import('./pages/PayslipDetailPage'));
const EmployeeOnboarding = lazy(() => import('./pages/EmployeeOnboardingPage'));
const MasterData = lazy(() => import('./pages/MasterDataPage'));
const RateEngine = lazy(() => import('./pages/RateEnginePage'));
const BarcodeOperations = lazy(() => import('./pages/BarcodeOperationsPage'));
const Profitability = lazy(() => import('./pages/ProfitabilityPage'));
const Bookings = lazy(() => import('./pages/BookingsPage'));
const VendorPortal = lazy(() => import('./pages/VendorPortalPage'));
const NotificationOutbox = lazy(() => import('./pages/NotificationOutboxPage'));
const Permissions = lazy(() => import('./pages/PermissionsPage'));
const AccountingWorkspace = lazy(() => import('./pages/AccountingWorkspacePage'));
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
                {role !== 'EMPLOYEE' && <Route path="dashboard" element={<Dashboard />} />}
                <Route path="shipments" element={<Shipments />} />
                <Route path="bookings" element={<Bookings />} />
                <Route path="segregations" element={<TmsModule />} />
                <Route path="shipments/create" element={<CreateLR />} />
                <Route path="shipments/:id" element={<ShipmentDetail />} />
                <Route path="documents" element={<Documents />} />
                <Route path="pickups" element={<TmsModule />} />
                <Route path="ptl-operations" element={<TmsModule />} />
                <Route path="ftl-operations" element={<TmsModule />} />
                <Route path="hubs" element={<TmsModule />} />
                <Route path="handling" element={<TmsModule />} />
                <Route path="manifests" element={<TmsModule />} />
                <Route path="manifests/:id" element={<TmsPrint resource="manifests" />} />
                <Route path="trips" element={<TmsModule />} />
                <Route path="drs" element={<TmsModule />} />
                {role !== 'EMPLOYEE' && <Route path="drs/:id" element={<DrsWorkspace />} />}
                {role !== 'EMPLOYEE' && <Route path="drs-closure" element={<DrsClosure />} />}
                {role !== 'EMPLOYEE' && (
                  <>
                    <Route path="customers" element={<Management />} />
                    <Route path="customers/:id" element={<CustomerDetail />} />
                    <Route path="fleet" element={<TmsModule />} />
                    <Route path="drivers" element={<TmsModule />} />
                    <Route path="company" element={<MasterData />} />
                    <Route path="locations" element={<MasterData />} />
                    <Route path="routes" element={<MasterData />} />
                    <Route path="items" element={<MasterData />} />
                    <Route path="package-types" element={<MasterData />} />
                    <Route path="rate-engine" element={<RateEngine />} />
                    <Route path="profitability" element={<Profitability />} />
                    <Route path="vendor-settlements" element={<TmsModule />} />
                    <Route path="eway-gst" element={<TmsModule />} />
                    <Route path="accounting" element={<AccountingWorkspace />} />
                    <Route path="hr" element={<TmsModule />} />
                    <Route path="claims" element={<TmsModule />} />
                    <Route path="notifications" element={<NotificationOutbox />} />
                    <Route path="system-settings" element={<TmsModule />} />
                  </>
                )}
                {role === 'MANAGER' && (
                  <>
                    <Route path="employees" element={<Management />} />
                    <Route path="onboarding" element={<EmployeeOnboarding />} />
                    <Route path="reports" element={<Reports />} />
                    <Route path="settings" element={<Settings />} />
                    <Route path="money-receipts" element={<TmsModule />} />
                    <Route path="money-receipts/:id" element={<TmsPrint resource="money-receipts" />} />
                    <Route path="invoices" element={<TmsModule />} />
                    <Route path="invoices/:id" element={<TmsPrint resource="invoices" />} />
                    <Route path="quotations" element={<TmsModule />} />
                    <Route path="quotations/:id" element={<TmsPrint resource="quotations" />} />
                    <Route path="stationery" element={<TmsModule />} />
                    <Route path="receivables" element={<Receivables />} />
                  </>
                )}
                {role === 'ADMIN' ? (
                  <>
                    <Route path="package-barcodes" element={<BarcodeOperations />} />
                    <Route path="managers" element={<Management />} />
                    <Route path="hr-users" element={<Management />} />
                    <Route path="vendor-users" element={<Management />} />
                    <Route path="permissions" element={<Permissions />} />
                    <Route path="employees" element={<Management />} />
                    <Route path="branches" element={<Management />} />
                    <Route path="reports" element={<Reports />} />
                    <Route path="audit" element={<Activity />} />
                    <Route path="settings" element={<Settings />} />
                    <Route path="vendors" element={<TmsModule />} />
                    <Route path="money-receipts" element={<TmsModule />} />
                    <Route path="money-receipts/:id" element={<TmsPrint resource="money-receipts" />} />
                    <Route path="invoices" element={<TmsModule />} />
                    <Route path="invoices/:id" element={<TmsPrint resource="invoices" />} />
                    <Route path="quotations" element={<TmsModule />} />
                    <Route path="quotations/:id" element={<TmsPrint resource="quotations" />} />
                    <Route path="stationery" element={<TmsModule />} />
                    <Route path="receivables" element={<Receivables />} />
                  </>
                ) : role === 'MANAGER' ? (
                  <>
                    <Route path="receive" element={<Receive />} />
                    <Route path="activity" element={<Activity />} />
                  </>
                ) : null}
              </Route>
            </Route>
          ))}
          <Route element={<ProtectedRoute role="HR" />}>
            <Route path="/hr" element={<AppLayout />}>
              <Route index element={<HomeRoute />} />
              <Route path="employees" element={<EmployeeOnboarding />} />
              <Route path="payslips" element={<Payslips />} />
              <Route path="payslips/:id" element={<PayslipDetail />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Route>
          <Route element={<ProtectedRoute role="VENDOR" />}>
            <Route path="/vendor" element={<AppLayout />}>
              <Route index element={<HomeRoute />} />
              <Route path="portal" element={<VendorPortal />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Route>
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
