import { idOf } from './workflow';

export const eligiblePrsPickups = (requests, prs) => {
  const added = new Set((prs.pickupRequestIds || []).map(idOf));
  return requests.filter((request) => request.shipmentId && !request.pickupRunSheetId && !added.has(idOf(request)));
};

// Allocate the saved payable in paise so LR amounts add up exactly to the PRS total.
export const prsVendorCommissions = (prs) => {
  const requests = prs.pickupRequestIds || [];
  const weights = requests.map((request) => {
    const entry = prs.purEntries?.find((row) => idOf(row.pickupRequestId) === idOf(request));
    const value = prs.rateSource !== 'MARKET' && prs.rateBasis === 'PER_BOX'
      ? entry?.packageCount ?? request.shipmentId?.packageCount ?? request.totalBoxes
      : entry?.weightKg ?? request.shipmentId?.weightKg ?? request.totalWeightKg;
    return Math.max(0, Number(value) || 0);
  });
  const sum = weights.reduce((total, value) => total + value, 0);
  const paise = Math.round(Math.max(0, Number(prs.vendorPayableAmount) || 0) * 100);
  if (!requests.length) return {};
  if (!sum && paise > 0) return Object.fromEntries(requests.map((request) => [idOf(request), null]));
  const shares = weights.map((weight, index) => {
    const exact = sum ? paise * weight / sum : 0;
    return { index, amount: Math.floor(exact), remainder: exact - Math.floor(exact) };
  });
  let remaining = paise - shares.reduce((total, share) => total + share.amount, 0);
  for (const share of [...shares].sort((a, b) => b.remainder - a.remainder || a.index - b.index)) {
    if (remaining <= 0) break;
    share.amount += 1;
    remaining -= 1;
  }
  return Object.fromEntries(shares.map((share) => [idOf(requests[share.index]), share.amount / 100]));
};
