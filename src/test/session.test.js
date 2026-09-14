import { afterEach, describe, it, expect, vi } from 'vitest';
import { AxiosError } from 'axios';
import {
  api,
  logistic,
  setSession,
  onSessionChange,
  errorMessage,
  formErrors,
} from '../api/client';
import { loginSchema, passwordSchema, customerSchema, shipmentFields } from '../schemas';
import { dateRangeParams } from '../lib/filters';
const originalAdapter = api.defaults.adapter;
afterEach(() => {
  api.defaults.adapter = originalAdapter;
  onSessionChange(() => { });
  setSession(null);
  vi.restoreAllMocks();
});
describe('Session logistic', () => {
  it('preserves explicit empty text so updates clear stored values', () => {
    expect(
      customerSchema.parse({
        name: 'Customer',
        mobile: '+919876543210',
        address: '',
        companyName: '',
      }),
    ).toMatchObject({ address: '', companyName: '' });
    expect(
      shipmentFields.parse({
        senderName: 'Sender',
        receiverName: 'Receiver',
        packageCount: 1,
        weightKg: 10,
        description: '',
      }).description,
    ).toBe('');
  });
  it('refreshes an expired token before changing password, without refreshing incorrect-password errors', async () => {
    setSession({
      accessToken: 'expired',
      user: { role: 'ADMIN', status: 'ACTIVE', name: 'Admin' },
    });
    const refresh = vi.spyOn(logistic, 'post').mockResolvedValue({
      data: {
        data: { accessToken: 'fresh', user: { role: 'ADMIN', status: 'ACTIVE', name: 'Admin' } },
      },
    });
    api.defaults.adapter = async (config) => {
      if (!config._retried)
        throw new AxiosError('Expired', '401', config, null, {
          status: 401,
          data: { errorCode: 'UNAUTHORIZED' },
          config,
        });
      return { status: 200, data: {}, config, headers: {} };
    };
    await api.post('/auth/change-password', {});
    expect(refresh).toHaveBeenCalledTimes(1);
    api.defaults.adapter = async (config) => {
      throw new AxiosError('Incorrect', '401', config, null, {
        status: 401,
        data: { errorCode: 'INVALID_PASSWORD' },
        config,
      });
    };
    await expect(api.post('/auth/change-password', {})).rejects.toThrow('Incorrect');
    expect(refresh).toHaveBeenCalledTimes(1);
  });
  it('preserves password whitespace exactly', () => {
    const value = '  secret password  ';
    expect(loginSchema.parse({ email: 'admin@example.test', password: value }).password).toBe(
      value,
    );
    expect(passwordSchema.parse({ currentPassword: value, newPassword: value }).newPassword).toBe(
      value,
    );
  });
  it('includes the entire selected final day in report filters', () => {
    const result = dateRangeParams({
      dateFrom: '2026-09-05',
      dateTo: '2026-09-05',
      status: 'BOOKED',
    });
    expect(new Date(result.dateFrom).getHours()).toBe(0);
    expect(new Date(result.dateTo).getHours()).toBe(23);
    expect(new Date(result.dateTo).getMilliseconds()).toBe(999);
    expect(result.status).toBe('BOOKED');
  });
  it('coalesces simultaneous 401s and retries with the new token', async () => {
    setSession({
      accessToken: 'expired',
      user: { role: 'ADMIN', status: 'ACTIVE', name: 'Admin' },
    });
    const refresh = vi.spyOn(logistic, 'post').mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 15));
      return {
        data: {
          data: { accessToken: 'fresh', user: { role: 'ADMIN', status: 'ACTIVE', name: 'Admin' } },
        },
      };
    });
    api.defaults.adapter = async (config) => {
      if (!config._retried)
        throw new AxiosError('Expired', '401', config, null, { status: 401, data: {}, config });
      return { status: 200, data: config.headers.Authorization, config, headers: {} };
    };
    const responses = await Promise.all([api.get('/shipments'), api.get('/dashboard/summary')]);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(responses.map((r) => r.data)).toEqual(['Bearer fresh', 'Bearer fresh']);
  });
  it('clears the session when refresh fails without retrying indefinitely', async () => {
    const listener = vi.fn();
    onSessionChange(listener);
    setSession({
      accessToken: 'expired',
      user: { role: 'ADMIN', status: 'ACTIVE', name: 'Admin' },
    });
    vi.spyOn(logistic, 'post').mockRejectedValue(new Error('Expired refresh'));
    api.defaults.adapter = async (config) => {
      throw new AxiosError('Expired', '401', config, null, { status: 401, data: {}, config });
    };
    await expect(api.get('/shipments')).rejects.toThrow('Expired refresh');
    expect(listener).toHaveBeenLastCalledWith(null);
  });
  it('maps backend field validation and suppresses server stack details', () => {
    const setError = vi.fn();
    formErrors(
      { response: { data: { errors: [{ field: 'mobile', message: 'Invalid mobile' }] } } },
      setError,
    );
    expect(setError).toHaveBeenCalledWith('mobile', { message: 'Invalid mobile' });
    expect(
      errorMessage({ response: { status: 500, data: { message: 'secret stack trace' } } }),
    ).not.toContain('secret');
  });
});
