import { expect, it } from 'vitest';
import { prsVendorCommissions } from '../lib/prs';
const requests = [
  { _id: 'a', shipmentId: { weightKg: 10, packageCount: 3 } },
  { _id: 'b', shipmentId: { weightKg: 30, packageCount: 1 } },
];
it('allocates per-kg and fixed or market totals by each LR weight', () => {
  for (const settings of [{ rateBasis: 'PER_KG', rateSource: 'MASTER' }, { rateBasis: 'FIXED', rateSource: 'MASTER' }, { rateBasis: 'PER_BOX', rateSource: 'MARKET' }]) {
    expect(prsVendorCommissions({ ...settings, vendorPayableAmount: 100, pickupRequestIds: requests })).toEqual({ a: 25, b: 75 });
  }
});
it('uses box count for master per-box rates', () => {
  expect(prsVendorCommissions({ rateBasis: 'PER_BOX', rateSource: 'MASTER', vendorPayableAmount: 100, pickupRequestIds: requests })).toEqual({ a: 75, b: 25 });
});
it('uses saved PRS metrics instead of later shipment changes', () => {
  expect(prsVendorCommissions({ rateBasis: 'PER_KG', vendorPayableAmount: 100, pickupRequestIds: requests, purEntries: [{ pickupRequestId: 'a', weightKg: 30 }, { pickupRequestId: 'b', weightKg: 10 }] })).toEqual({ a: 75, b: 25 });
});
it('rounds LR amounts in paise without losing the payable total', () => {
  const result = prsVendorCommissions({ vendorPayableAmount: 100, pickupRequestIds: ['a', 'b', 'c'].map((_id) => ({ _id, totalWeightKg: 1 })) });
  expect(result).toEqual({ a: 33.34, b: 33.33, c: 33.33 });
});
it('does not invent weight allocations when weight is missing', () => {
  expect(prsVendorCommissions({ vendorPayableAmount: 100, pickupRequestIds: [{ _id: 'a' }] })).toEqual({ a: null });
});
