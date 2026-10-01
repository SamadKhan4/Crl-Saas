import { idOf } from './workflow';

export const belongsToPrsBranch = (request, prs, user) =>
  idOf(request.branchId) === idOf(prs.branchId) ||
  (['ADMIN', 'MANAGER'].includes(user.role) && !idOf(request.branchId) &&
    Boolean(idOf(prs.marketPickupRequestId)) && idOf(request) === idOf(prs.marketPickupRequestId));

export const eligiblePrsPickups = (requests, prs, user) => {
  const added = new Set((prs.pickupRequestIds || []).map(idOf));
  return requests.filter((request) => belongsToPrsBranch(request, prs, user) &&
    request.shipmentId && !request.pickupRunSheetId && !added.has(idOf(request)));
};
