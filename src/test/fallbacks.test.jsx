import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { DataTable } from '../components/common/UI';
import {
  api,
  get,
  errorMessage,
  refreshSession,
  setSession,
  onSessionChange,
  logistic,
  formErrors,
} from '../api/client';
import { readStorage, writeStorage } from '../lib/storage';
import { copyText } from '../lib/clipboard';
import { actionsFor, date } from '../lib/workflow';
import FileUploader from '../components/forms/FileUploader';
import ConnectionNotice from '../components/common/ConnectionNotice';
import { AxiosError } from 'axios';
import { post, validateSession } from '../api/client';
const originalAdapter = api.defaults.adapter;
afterEach(() => {
  vi.unstubAllGlobals();
  api.defaults.adapter = originalAdapter;
  vi.restoreAllMocks();
  onSessionChange(() => { });
  setSession(null);
});
describe('Recoverable failures', () => {
  it('rejects incomplete or disabled authentication profiles', () => {
    expect(() => validateSession({ accessToken: 'token', user: { role: 'ADMIN' } })).toThrow();
    expect(() =>
      validateSession({
        accessToken: 'token',
        user: { name: 'Admin', role: 'ADMIN', status: 'INACTIVE' },
      }),
    ).toThrow();
  });
  it('keeps the selected file after upload failure and allows a successful retry', async () => {
    const upload = vi
      .fn()
      .mockRejectedValueOnce({ code: 'ECONNABORTED' })
      .mockResolvedValueOnce({});
    const success = vi.fn();
    render(<FileUploader onUpload={upload} onSuccess={success} />);
    await userEvent.upload(
      screen.getByLabelText('LR document'),
      new File(['data'], 'signed.pdf', { type: 'application/pdf' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Upload document' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('timed out');
    expect(success).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Upload document' }));
    expect(success).toHaveBeenCalledTimes(1);
  });
  it('shows an offline notice instead of implying unsaved actions were queued', () => {
    vi.stubGlobal('navigator', { onLine: false });
    render(<ConnectionNotice />);
    expect(screen.getByRole('status')).toHaveTextContent('have not been queued');
  });
  it('rejects HTML success responses for writes', async () => {
    vi.spyOn(api, 'post').mockResolvedValue({ data: '<html>Proxy error</html>' });
    await expect(post('/customers', {})).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
  it('does not clear a new session when a previous user request returns 401', async () => {
    let rejectOld;
    const listener = vi.fn();
    onSessionChange(listener);
    setSession({ accessToken: 'first', user: { role: 'ADMIN' } });
    api.defaults.adapter = (config) =>
      new Promise((_resolve, reject) => {
        rejectOld = () =>
          reject(new AxiosError('Expired', '401', config, null, { status: 401, data: {}, config }));
      });
    const request = api.get('/shipments');
    await Promise.resolve();
    await Promise.resolve();
    setSession({ accessToken: 'second', user: { role: 'EMPLOYEE' } });
    rejectOld();
    await expect(request).rejects.toThrow('Expired');
    expect(listener).toHaveBeenLastCalledWith({ role: 'EMPLOYEE' });
  });
  it('renders a safe crash fallback and can retry', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => { });
    let fail = true;
    function Broken() {
      if (fail) throw new Error('private stack details');
      return <p>Page recovered</p>;
    }
    render(
      <ErrorBoundary>
        <Broken />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).not.toHaveTextContent('private stack');
    fail = false;
    await userEvent.click(screen.getByRole('button', { name: 'Try page again' }));
    expect(screen.getByText('Page recovered')).toBeInTheDocument();
  });
  it('keeps previous-page navigation when the current page becomes empty', async () => {
    const onPage = vi.fn();
    render(
      <DataTable
        columns={[]}
        rows={[]}
        pagination={{ page: 2, pages: 1, total: 1, limit: 20 }}
        onPage={onPage}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Previous page' }));
    expect(onPage).toHaveBeenCalledWith(1);
  });
  it('rejects malformed list responses instead of treating them as empty success', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ data: { success: true, data: null } });
    await expect(get('/shipments')).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
  it('handles missing errors, timeout, HTML errors, and malformed field errors safely', () => {
    expect(errorMessage()).toMatch(/connect|offline/i);
    expect(errorMessage({ code: 'ECONNABORTED' })).toMatch(/timed out/);
    expect(
      errorMessage({ response: { status: 403, data: { message: '<html>private stack</html>' } } }),
    ).toBe('You do not have permission for this action.');
    expect(() =>
      formErrors({ response: { data: { errors: { unexpected: true } } } }, vi.fn()),
    ).not.toThrow();
  });
  it('falls back when browser storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Blocked');
    });
    expect(readStorage('localStorage', 'test')).toBeNull();
    expect(() => writeStorage('localStorage', 'test', 'value')).not.toThrow();
  });
  it('rejects unavailable clipboard support asynchronously', async () => {
    vi.stubGlobal('navigator', { clipboard: undefined });
    await expect(copyText('LR')).rejects.toThrow('Clipboard unavailable');
  });
  it('does not enable employee actions when branch IDs are missing', () => {
    expect(actionsFor({ currentStatus: 'BOOKED' }, { role: 'EMPLOYEE', status: 'ACTIVE' })).toEqual(
      [],
    );
    expect(date('invalid')).toBe('—');
  });
  it('does not restore a session after logout while refresh is pending', async () => {
    let resolve;
    vi.spyOn(logistic, 'post').mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const listener = vi.fn();
    onSessionChange(listener);
    setSession({ accessToken: 'old', user: { role: 'ADMIN' } });
    const refresh = refreshSession();
    setSession(null);
    resolve({ data: { data: { accessToken: 'new', user: { role: 'ADMIN' } } } });
    await expect(refresh).rejects.toMatchObject({ code: 'ERR_CANCELED' });
    expect(listener).toHaveBeenLastCalledWith(null);
  });
});

describe('Manager and branch option response contracts', () => {
  it.each(['/managers', '/branches/options'])(
    'accepts populated and empty lists from %s',
    async (path) => {
      const fetch = vi.spyOn(api, 'get');
      for (const data of [[], [{ _id: 'a'.repeat(24), name: 'Test record' }]]) {
        fetch.mockResolvedValueOnce({ data: { success: true, data } });
        await expect(get(path)).resolves.toEqual({ success: true, data });
      }
    },
  );
  it.each(['/managers', '/branches/options'])('rejects malformed lists from %s', async (path) => {
    const fetch = vi.spyOn(api, 'get');
    for (const data of [{}, null, ['invalid'], [null]]) {
      fetch.mockResolvedValueOnce({ data: { success: true, data } });
      await expect(get(path)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    }
  });
  it('still requires an object for a manager detail response', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ data: { success: true, data: [] } });
    await expect(get('/managers/' + 'a'.repeat(24))).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
  });
});
