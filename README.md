# CRL Transport Management System

React / JavaScript (JSX), Vite, Tailwind CSS, React Router, TanStack Query, Axios, React Hook Form, Zod, Recharts, Lucide and Sonner. Production pages call the existing backend; there is no demo data or demo login.

## Run

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

The frontend defaults to `http://localhost:5173`. Start the existing `../crl -Backend` separately with its configured database and administrator account. Development requests to `/api` are proxied to `http://localhost:5000`. No backend files have been changed.

Environment variables:

- `VITE_API_BASE_URL=/api`: browser-visible API prefix.
- `VITE_APP_NAME=CRL Transport`: brand label.
- `API_PROXY_TARGET=http://localhost:5000`: development-only proxy target.

In production, configure the web server to serve `dist`, rewrite application URLs to `index.html`, and proxy `/api` to the backend. Preserve `/api/auth` so the backend's HTTP-only refresh cookie path works. Use HTTPS and configure the backend's secure cookies and CORS appropriately. A same-origin deployment is recommended because the backend uses SameSite=Strict cookies. Do not put secrets in Vite variables.

## Structure

```text
src/
  api/                 Axios logistic, error mapping, resource services
  components/
    common/            Headers, stats, tables, dialogs, states, timelines
    forms/             Debounced search, remote lookup, file uploader
    layout/            Shared responsive sidebar and header
    shipment/          Shipment table, workflow actions, protected preview
  features/auth/       Session context and authentication
  hooks/               URL list state and debouncing
  lib/                 Status labels, workflow permissions, file validation
  pages/               Lazy-loaded route modules
  routes/              Authentication and role guards
  schemas/             Zod validation aligned to backend schemas
  test/                API-boundary component and permission tests
```

The project intentionally uses JavaScript, as requested; Zod schemas provide runtime validation rather than adding a separate TypeScript build.

## Routes and features

- `/login`: shared admin/employee login, password visibility, remember-session preference.
- `/admin/dashboard`, `/employee/dashboard`: actual summary counts, status chart, admin branch chart, recent shipments, pending verifications, employee quick actions.
- `/{admin|employee}/shipments`: search, status/customer/branch/date filters, sorting and pagination persisted in URL, plus branch-aware operational actions directly from each row.
- `/{admin|employee}/shipments/create`: customer lookup, sender/receiver and shipment form, backend LR generation, idempotent retry key, success/copy/repeat flow.
- `/{admin|employee}/shipments/:id`: overview, status progress, tracking history, document versions, authenticated preview/download; branch- and status-aware mutation dialogs.
- `/{admin|employee}/customers`, `/{admin|employee}/customers/:id`: create/edit/activate/deactivate, customer details and paginated shipments.
- `/admin/employees`: employee create/edit, branch assignment, activate/deactivate, password reset.
- `/admin/branches`: branch creation, edit and status changes.
- `/{admin|employee}/documents`: shipment queues for pending verification, verified shipments and awaiting uploads. Individual shipment pages contain complete document version history.
- `/employee/receive`: LR lookup and explicit receiving confirmation.
- `/admin/reports`: server filters, summary counts derived from returned report, paginated presentation and backend CSV export.
- `/admin/settings`: account information and password change.
- `/admin/audit`, `/employee/activity`: explicit unavailable state because read endpoints are absent.
- `/track`: public safe shipment response and timeline, without internal customer information.
- `/request-upload`: customer code/LR request for a secure one-time upload session.
- `/upload-lr/:token`: upload without login, local file validation, progress and server error/success handling.

Shared components include AppLayout/Brand, PageHeader, StatCard, DataTable, Pagination, SearchInput, StatusBadge, EmptyState, ErrorState, Loadingcrleleton, Modal, ConfirmDialog, FormField, Lookup, FileUploader, ShipmentTimeline, ActivityTimeline, DocumentPreview, ProtectedRoute and PermissionGuard. Native date inputs provide accessible date picking. Tables use labeled card rows on mobile.

## API and authentication

Services use the exact routes and response envelopes in `../crl -Backend/src/routes/index.js`, validators and services. Access tokens remain in memory. HTTP-only refresh cookies use credentialed requests. A shared refresh promise prevents parallel 401 refresh storms; browser Web Locks serialize refresh operations between tabs where supported. Refresh failures clear the session and cached private data. Direct URLs are role protected; the server remains responsible for enforcing all permissions.

Remember me stores only a preference, never a password or access token. Without it, restoration is limited to the current tab session. The backend currently controls the cookie's persistent lifetime independently of this preference.

All writes surface backend business-rule errors. Important status, verification, deactivation, reset and override actions require confirmation. Backend field errors map to React Hook Form fields. File checks allow JPG/JPEG/PNG/WEBP/PDF up to 10 MB; the server validates actual bytes. Authenticated downloads use blob URLs that are revoked when no longer needed.

## Backend contract gaps

These are deliberately not simulated:

1. Audit and employee activity read endpoints are missing. No full audit feed, old/new values or dashboard recent activity can be fetched.
2. Employee `/branches` returns only the assigned branch. Employee LR creation therefore accepts the destination ObjectId supplied by an administrator. A safe active destination-directory endpoint is needed for employee destination search.
3. Shipment creation accepts only customer/branch IDs, sender name, receiver name/mobile, package count, weight, description and expected delivery. Expanded consignor/consignee addresses, invoice, e-way bill, special instructions and user-entered booking date need backend schema/model changes. Unsupported form values are not silently discarded.
4. Dashboard has counts and branch totals, but no dedicated time-series endpoint, today's deliveries or completed-today count. The 30-day booking chart is derived from the real filtered report endpoint. Unavailable delivery metrics are not shown as fabricated zeroes. The status chart includes all eight lifecycle states.
5. No global document listing endpoint exists. Queue tabs are based on current shipment status, not a complete global document-status index. Previously verified documents on completed/closed shipments and rejected versions remain accessible from shipment details.
6. Shipment listing omits `createdBy`. The table cannot display creator names. Report API supports one branch filter matching either end, not separate origin/destination filters; reports return all filtered rows without server pagination.
7. Upload tokens have no safe GET/introspection endpoint. The upload screen cannot show shipment details before submitting. Expired and used tokens share the backend's friendly combined error.
8. Inspection found a likely backend employee detail-access problem: `shipmentDetails` compares populated branch objects with `.toString()` while the scope helper expects raw IDs. Employee detail calls may return 403 even when list access is valid. Fix/test this in the backend before releasing the employee detail workflow.
9. The backend branch status service currently permits deactivation without checking active shipment dependencies. The UI confirms changes and surfaces any backend rejection, but cannot enforce atomic dependency protection itself.
10. No notification API is available; the header does not display a fabricated notification count.
11. The backend accepts empty strings for optional free-text fields, which can be cleared. Previously saved email/mobile/pincode/GST/date fields cannot be cleared under its current validation contract; the frontend acrls for a replacement instead of silently retaining the previous value.

## Validation

Failure recovery includes page-level error boundaries (navigation remains available), manual retry/reload for rendering or lazy-chunk failures, an offline notice, safe timeout/error messages, API response-envelope checks, blocked-storage and missing-clipboard fallbacks, and previous-page navigation when a paginated page becomes empty. Upload failures retain the selected file for an explicit retry; uploads are not automatically replayed.

Authentication ignores late refresh/401 responses from an earlier session. Logout clears this browser's local session immediately, even if the server is unreachable; server-side revocation can only be confirmed when the logout request succeeds. Unknown or inactive authentication profiles are rejected. These safeguards improve recovery but do not replace backend validation or live end-to-end testing.

```powershell
npm run lint
npm run build
npm test
npx prettier --check .
```

Vitest and React Testing Library test login, direct role routing, list loading, LR validation, status/branch permissions, receipt confirmation, rejection validation, file upload boundaries, public tracking and token upload. API responses are mocked only inside tests.

Live end-to-end admin/employee workflow validation requires a running backend, reachable configured database, and test accounts for origin and destination branches. No credentials are hardcoded. The backend was unreachable at localhost:5000 during implementation. In-app browser verification could not start because its tooling returned `missing field sandboxPolicy`; build success does not establish visual/browser QA.
