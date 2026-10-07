import { afterEach, describe, expect, it } from 'vitest';
import { AxiosError } from 'axios';
import { api } from '../api/client';
import { getPendingRequests } from '../api/requestActivity';

const originalAdapter = api.defaults.adapter;
afterEach(() => { api.defaults.adapter = originalAdapter; });

const waitForRequests = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('global API loading activity', () => {
  it('stays busy until every overlapping request completes', async () => {
    const complete = [];
    api.defaults.adapter = (config) => new Promise((resolve) => {
      complete.push(() => resolve({ status: 200, data: {}, config, headers: {} }));
    });
    const first = api.get('/loader-first');
    const second = api.get('/loader-second');
    await waitForRequests();
    expect(getPendingRequests()).toBe(2);
    complete[0]();
    await first;
    expect(getPendingRequests()).toBe(1);
    complete[1]();
    await second;
    expect(getPendingRequests()).toBe(0);
  });

  it.each(['ECONNABORTED', 'ERR_CANCELED', 'ERR_NETWORK'])('clears after %s', async (code) => {
    api.defaults.adapter = async (config) => {
      throw new AxiosError('Request failed', code, config);
    };
    await expect(api.get('/loader-error')).rejects.toThrow('Request failed');
    expect(getPendingRequests()).toBe(0);
  });
});
