import axios from 'axios';

const configuredApiUrl = import.meta.env?.VITE_API_BASE_URL;
const API_BASE_URL = (
  import.meta.env.PROD && !/^https:\/\//.test(configuredApiUrl || '')
    ? 'https://api.crl-transport.com/api'
    : configuredApiUrl || '/api'
).replace(/\/$/, '');
const AUTH_PATH = /^\/auth\/(login|refresh|logout)$/;

let accessToken = null;
let sessionVersion = 0;
let sessionListener = () => {};
let refreshPromise = null;

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 12000,
  headers: { Accept: 'application/json' },
});

// Existing API services import this name. It is the same real HTTP client.
export const logistic = api;

api.interceptors.request.use((config) => {
  config.__sessionVersion = sessionVersion;
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

async function refreshAccessToken(expectedVersion = sessionVersion) {
  if (!refreshPromise) {
    refreshPromise = api
      .post('/auth/refresh', undefined, { __skipAuthRefresh: true })
      .then((response) => {
        if (expectedVersion !== sessionVersion) {
          throw Object.assign(new Error('Session changed while refreshing.'), { code: 'ERR_CANCELED' });
        }
        const body = checkEnvelope(response.data);
        if (!body.data?.accessToken) throw invalidResponse();
        accessToken = body.data.accessToken;
        return body.data;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const request = error?.config;
    const status = error?.response?.status;
    if (
      status !== 401 ||
      !request ||
      request.__skipAuthRefresh ||
      request.__retriedAfterRefresh ||
      AUTH_PATH.test(request.url || '') ||
      request.__sessionVersion !== sessionVersion
    ) {
      return Promise.reject(error);
    }
    try {
      await refreshAccessToken(request.__sessionVersion);
      if (request.__sessionVersion !== sessionVersion) return Promise.reject(error);
      request.__retriedAfterRefresh = true;
      request.headers = request.headers || {};
      request.headers.Authorization = `Bearer ${accessToken}`;
      return api.request(request);
    } catch {
      if (request.__sessionVersion === sessionVersion) setSession(null);
      return Promise.reject(error);
    }
  },
);

export function onSessionChange(listener) {
  sessionListener = listener;
}

export function setSession(session) {
  sessionVersion += 1;
  accessToken = session?.accessToken || null;
  sessionListener(session?.user || null);
}

export async function authenticateDemo({ email, password }) {
  const response = await api.post('/auth/login', { email, password }, { __skipAuthRefresh: true });
  const body = checkEnvelope(response.data);
  if (!body.data?.accessToken || !body.data?.user) throw invalidResponse();
  return { accessToken: body.data.accessToken, user: body.data.user };
}

export async function refreshSession() {
  const expectedVersion = sessionVersion;
  const refreshed = await refreshAccessToken(expectedVersion);
  if (expectedVersion !== sessionVersion) {
    throw Object.assign(new Error('Session changed while refreshing.'), { code: 'ERR_CANCELED' });
  }
  if (refreshed.user) return { accessToken: refreshed.accessToken, user: refreshed.user };
  const response = await api.get('/auth/me', { __skipAuthRefresh: true });
  const body = checkEnvelope(response.data);
  const user = body.data?.user || body.data;
  return validateSession({ accessToken: refreshed.accessToken, user });
}

export async function logoutSession() {
  try {
    await api.post('/auth/logout', undefined, { __skipAuthRefresh: true });
  } finally {
    setSession(null);
  }
}

export function invalidResponse() {
  return Object.assign(new Error('The server returned an invalid response.'), { code: 'INVALID_RESPONSE' });
}

export function checkEnvelope(body) {
  if (!body || typeof body !== 'object' || body.success !== true || !Object.hasOwn(body, 'data') || body.data === null) {
    throw invalidResponse();
  }
  return body;
}

export function validateSession(session) {
  const user = session?.user;
  if (
    !session?.accessToken ||
    !user ||
    typeof user !== 'object' ||
    !user.id ||
    !user.name ||
    !user.email ||
    !['ADMIN', 'MANAGER', 'EMPLOYEE'].includes(user.role) ||
    user.status !== 'ACTIVE'
  ) {
    throw invalidResponse();
  }
  return session;
}

export function errorMessage(error) {
  if (!error) return 'Unable to connect to the server. Please try again.';
  if (error.code === 'ECONNABORTED') return 'The request timed out. Please try again.';
  if (error.code === 'ERR_CANCELED' || error.name === 'CanceledError') return 'The request was cancelled.';
  const status = error.response?.status;
  if (status === 401) return 'Your session has expired. Please sign in again.';
  if (status === 403) return 'You do not have permission for this action.';
  if (status === 404) return 'The requested record was not found.';
  if (status === 409) return error.response?.data?.message || 'This record has changed. Refresh and try again.';
  if (status === 422) return error.response?.data?.message || 'Please correct the highlighted fields.';
  if (status && status >= 500) return 'The server could not complete this request. Please try again.';
  return typeof error.response?.data?.message === 'string' && !error.response.data.message.includes('<')
    ? error.response.data.message
    : error.message || 'Unable to connect to the server. Please try again.';
}

export function formErrors(error, setError) {
  const errors = error?.response?.data?.errors;
  if (!setError || !errors || typeof errors !== 'object') return;
  const fields = Array.isArray(errors) ? errors : Object.entries(errors).map(([field, value]) => ({ field, message: value }));
  for (const entry of fields) {
    const field = entry?.field || entry?.path || entry?.key;
    const message = Array.isArray(entry?.message) ? entry.message.join(', ') : entry?.message;
    if (typeof field === 'string' && typeof message === 'string') {
      setError(field.replace(/^lrDetails\./, ''), { message });
    }
  }
}

export const get = (path, params) => api.get(path, { params }).then((response) => checkEnvelope(response.data));
export const post = (path, body, config) => api.post(path, body, config).then((response) => checkEnvelope(response.data));

export async function download(path, name) {
  const response = await api.get(path, { responseType: 'blob' });
  const url = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}
