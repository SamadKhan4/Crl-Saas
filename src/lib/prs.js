import { idOf } from './workflow';

export const eligiblePrsPickups = (requests, prs) => {
  const added = new Set((prs.pickupRequestIds || []).map(idOf));
  return requests.filter((request) => request.shipmentId && !request.pickupRunSheetId && !added.has(idOf(request)));
};
