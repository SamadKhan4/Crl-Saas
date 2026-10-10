import { api, get, post, logistic, checkEnvelope, invalidResponse } from './client';
import { dateRangeParams } from '../lib/filters';
export const resourceApi = (resource) => ({
  list: (params) => get(`/${resource}`, params),
  detail: (id) => get(`/${resource}/${id}`),
  create: (body) => post(`/${resource}`, body),
  update: (id, body) => api.put(`/${resource}/${id}`, body).then((r) => checkEnvelope(r.data)),
  status: (id, body) =>
    api.patch(`/${resource}/${id}/status`, typeof body === 'string' ? { status: body } : body).then((r) => checkEnvelope(r.data)),
});
export const registerApi = (resource) => resourceApi(`tms-registers/${resource}`);
export const customersApi = { ...resourceApi('customers'), lookup: (params) => get('/customers/lookup', params) };
export const branchesApi = resourceApi('branches');
export const usersApi = resourceApi('users');
export const shipmentsApi = {
  ...resourceApi('shipments'),
  list: (params) => get('/shipments', dateRangeParams(params)),
  create: (body, key) => post('/shipments', body, { headers: { 'Idempotency-Key': key } }),
  history: (id) => get(`/shipments/${id}/history`),
  action: (id, action, body = {}) => post(`/shipments/${id}/${action}`, body),
};
export const dashboardApi = { summary: () => get('/dashboard/summary') };
export const reportsApi = { list: (params) => get('/reports/shipments', dateRangeParams(params)) };
export const vendorsApi = resourceApi('vendors');
export const manifestsApi = resourceApi('manifests');
export const segregationsApi = resourceApi('segregations');
export const tripsApi = resourceApi('trips');
export const middleMileApi = {
  hubInward: (body) => post('/middle-mile/hub-inward', body),
  sortings: (params) => get('/middle-mile/sorting', params),
  sortingInventory: (params) => get('/middle-mile/sorting/inventory', params),
  sort: (body) => post('/middle-mile/sorting', body),
  hold: (id, body) => post(`/middle-mile/shipments/${id}/hold`, body),
  sortingOptions: (params) => get('/segregations/options', params),
  tallies: resourceApi('loading-tallies'),
  scanTally: (id, barcode) => post(`/loading-tallies/${id}/scan`, { barcode }),
  completeTally: (id) => post(`/loading-tallies/${id}/complete`, {}),
  manifests: resourceApi('middle-mile/manifests'),
  finalizeManifest: (id) => post(`/middle-mile/manifests/${id}/finalize`, {}),
  trips: resourceApi('middle-mile/trips'),
  dispatchTrip: (id) => post(`/middle-mile/trips/${id}/dispatch`, {}),
  arriveTrip: (id) => post(`/middle-mile/trips/${id}/arrive`, {}),
  destinationInward: (id, receivedShipmentIds, remarks) =>
    post(`/middle-mile/trips/${id}/inward`, { receivedShipmentIds, remarks }),
};
export const branchOptionsApi = { list: () => get('/branches/options') };
export const masterOptionsApi = { list: (type, params = {}) => get('/master-data/options', { ...params, type, status: 'ACTIVE', limit: 100 }) };
export const vendorOptionsApi = { list: () => get('/vendors/options', { limit: 100 }) };
export const drsApi = resourceApi('drs');
export const lastMileApi = {
  arrivals: (params) => get('/last-mile/arrivals', params),
  tallies: resourceApi('last-mile/unloading-tallies'),
  scanTally: (id, barcode) => post(`/last-mile/unloading-tallies/${id}/scan`, { barcode }),
  completeTally: (id, exceptions = []) => post(`/last-mile/unloading-tallies/${id}/complete`, { exceptions }),
  updateQc: (id, shipmentId, body) => api.patch(`/last-mile/unloading-tallies/${id}/qc/${shipmentId}`, body).then((r) => checkEnvelope(r.data)),
  inward: (id, remarks) => post(`/last-mile/unloading-tallies/${id}/inward`, { remarks: remarks || undefined }),
  inventory: (params) => get('/last-mile/drs-inventory', params),
  drsManifests: (params) => get('/last-mile/drs-manifests', params),
  drs: resourceApi('last-mile/drs'),
  finalizeDrs: (id) => post(`/last-mile/drs/${id}/finalize`, {}),
  dispatchDrs: (id) => post(`/last-mile/drs/${id}/dispatch`, {}),
  attempt: (id, shipmentId, body) => post(`/last-mile/drs/${id}/attempt/${shipmentId}`, body),
  closeDrs: (id) => post(`/last-mile/drs/${id}/close`, {}),
};
export const invoicesApi = resourceApi('invoices');
export const receiptsApi = resourceApi('money-receipts');
export const quotationsApi = resourceApi('quotations');
export const stationeryApi = resourceApi('stationery');
export const receivablesApi = { summary: (params) => get('/receivables/summary', params) };
export const masterDataApi = {
  ...resourceApi('master-data'),
  expiring: (params) => get('/master-data/expiring-documents', params),
};
export const rateCardsApi = {
  ...resourceApi('rate-cards'),
  quote: (body) => post('/rate-cards/quote', body),
};
export const packageBarcodesApi = {
  list: (params) => get('/package-barcodes', params),
  detail: (barcode) => get(`/package-barcodes/${encodeURIComponent(barcode)}`),
  scan: (barcode, body) => post(`/package-barcodes/${encodeURIComponent(barcode)}/scan`, body),
  reprint: (barcode) => post(`/package-barcodes/${encodeURIComponent(barcode)}/reprint`, {}),
};
export const profitabilityApi = { summary: (params) => get('/profitability', dateRangeParams(params)) };
export const accountingSummaryApi = { summary: (params) => get('/accounting/summary', params) };
export const bookingsApi = {
  ...resourceApi('bookings'),
  linkLr: (id, shipmentId) => post(`/bookings/${id}/link-lr`, { shipmentId }),
  generateLr: (id, body) => post(`/bookings/${id}/generate-lr`, body),
};
export const pickupRequestsApi = {
  ...resourceApi('pickup-requests'),
  summary: () => get('/pickup-requests/summary'),
  updateStatus: (id, status) =>
    api.patch(`/pickup-requests/${id}/status`, { status }).then((response) => checkEnvelope(response.data)),
  assignAgent: (id, body) =>
    api.patch(`/pickup-requests/${id}/assign-agent`, body).then((response) => checkEnvelope(response.data)),
};
export const pickupRunSheetsApi = {
  ...resourceApi('pickup-run-sheets'),
  options: () => get('/pickup-run-sheets/options'),
  addPickup: (id, body) => post(`/pickup-run-sheets/${id}/pickups`, body),
  review: (id, body) => api.patch(`/pickup-run-sheets/${id}/approval`, body).then((response) => checkEnvelope(response.data)),
  dispatch: (id) => post(`/pickup-run-sheets/${id}/dispatch`, {}),
};
export const agentLrsApi = { list: (params) => get('/agent-lrs', params) };
export const payslipsApi = resourceApi('payslips');
export const onboardingApi = {
  ...resourceApi('employee-onboarding'),
  upload: (id, documentType, body, onUploadProgress) => api.post(`/employee-onboarding/${id}/documents/${documentType}`, body, { onUploadProgress }).then((r) => checkEnvelope(r.data)),
  review: (id, body) => post(`/employee-onboarding/${id}/review`, body),
  download: (id, documentId) => api.get(`/employee-onboarding/${id}/documents/${documentId}/file`, { responseType: 'blob' }),
};
export const publicApi = {
  track: (lr) =>
    logistic.get(`/public/track/${encodeURIComponent(lr)}`).then((r) => {
      const body = checkEnvelope(r.data);
      if (
        !body.data ||
        typeof body.data.lrNumber !== 'string' ||
        typeof body.data.status !== 'string' ||
        !Array.isArray(body.data.trackingHistory)
      )
        throw invalidResponse();
      return body;
    }),
  request: (body) =>
    logistic.post('/public/lr-upload/request', body).then((r) => checkEnvelope(r.data)),
  upload: (token, body, onUploadProgress) =>
    logistic
      .post(`/public/lr-upload/${encodeURIComponent(token)}`, body, { onUploadProgress })
      .then((r) => checkEnvelope(r.data)),
  quotation: (body) => logistic.post('/public/quotations', body).then((r) => checkEnvelope(r.data)),
};
