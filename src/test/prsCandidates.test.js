import { describe, it, expect } from 'vitest';
import { eligiblePrsPickups } from '../lib/prs';

describe('PRS pickup eligibility', () => {
  const prs = { branchId: 'branch-a', marketPickupRequestId: 'market-pur', pickupRequestIds: [] };
  const market = { _id: 'market-pur', shipmentId: { _id: 'lr' } };
  it('includes the branch-less market source with a generated LR for an admin', () => {
    expect(eligiblePrsPickups([market], prs, { role: 'ADMIN' })).toEqual([market]);
  });
  it('excludes missing LRs and assigned PURs, allowing other offices', () => {
    const requests = [{ ...market, shipmentId: null }, { ...market, branchId: 'branch-b' },
      { ...market, _id: 'other' }, { ...market, pickupRunSheetId: 'another-prs' }];
    expect(eligiblePrsPickups(requests, prs, { role: 'ADMIN' })).toEqual([requests[1], requests[2]]);
    expect(eligiblePrsPickups([market], prs, { role: 'EMPLOYEE' })).toEqual([market]);
    expect(eligiblePrsPickups([market], { ...prs, pickupRequestIds: [{ _id: market._id }] }, { role: 'ADMIN' })).toEqual([]);
  });
  it('continues to include same-branch vendor PURs', () => {
    const vendor = { _id: 'vendor-pur', branchId: { _id: 'branch-a' }, shipmentId: 'lr' };
    expect(eligiblePrsPickups([vendor], prs, { role: 'EMPLOYEE' })).toEqual([vendor]);
  });
});
