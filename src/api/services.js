import { api, get, post, logistic, checkEnvelope, invalidResponse } from './client';
import { dateRangeParams } from '../lib/filters';
export const resourceApi = (resource) => ({
  list: (params) => get(`/${resource}`, params),
  detail: (id) => get(`/${resource}/${id}`),
  create: (body) => post(`/${resource}`, body),
  update: (id, body) => api.put(`/${resource}/${id}`, body).then((r) => checkEnvelope(r.data)),
  status: (id, status) =>
    api.patch(`/${resource}/${id}/status`, { status }).then((r) => checkEnvelope(r.data)),
});
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
export const tripsApi = resourceApi('trips');
export const drsApi = resourceApi('drs');
export const invoicesApi = resourceApi('invoices');
export const receiptsApi = resourceApi('money-receipts');
export const quotationsApi = resourceApi('quotations');
export const stationeryApi = resourceApi('stationery');
export const receivablesApi = { summary: (params) => get('/receivables/summary', params) };
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
