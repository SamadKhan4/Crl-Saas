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
export const customersApi = resourceApi('customers');
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
export const drsApi = resourceApi('drs');
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
