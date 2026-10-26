export const journeyStages = [
  { title: 'LR booked', description: 'Shipment registered' },
  { title: 'Picked up', description: 'Goods collected' },
  { title: 'Origin hub', description: 'Sorting and loading' },
  { title: 'In transit', description: 'Trip dispatched' },
  { title: 'Branch received', description: 'Unloading and receipt' },
  { title: 'Out for delivery', description: 'DRS and delivery attempt' },
  { title: 'Delivered', description: 'Delivery confirmed' },
];

const stageByStatus = {
  BOOKED: 0, PICKED_UP: 1,
  AT_HUB: 2, HUB_INWARDED: 2, SORTING_PENDING: 2, SORTED: 2, SEGREGATED: 2,
  LOADING: 2, LOADING_TALLY_COMPLETED: 2, MANIFESTED: 2, MANIFEST_LOCKED: 2, TRIP_ASSIGNED: 2, TRIP_PLANNED: 2,
  IN_TRANSIT: 3,
  ARRIVED: 4, RECEIVED: 4, UNLOADING: 4, UNLOADING_COMPLETED: 4, DESTINATION_HUB_INWARDED: 4,
  QC_PENDING: 4, QC_PASSED: 4, QC_HOLD: 4, LAST_MILE_READY: 4, DESTINATION_INWARDED: 4,
  DRS_ASSIGNED: 5, OUT_FOR_DELIVERY: 5, DELIVERY_ATTEMPTED: 5, DELIVERY_FAILED: 5, POD_UPLOADED: 5,
  DELIVERED: 6,
};

export function shipmentJourney(shipment, events = []) {
  const scans = [...events].sort((a, b) => new Date(a.timestamp || a.createdAt || 0) - new Date(b.timestamp || b.createdAt || 0));
  const evidence = new Map();
  evidence.set(0, { timestamp: shipment.bookingDate || shipment.createdAt, location: shipment.origin || shipment.lrDetails?.from || shipment.originBranchId?.city });
  let latestStage = 0;
  for (const event of scans) {
    const stage = stageByStatus[event.status];
    if (stage !== undefined) { evidence.set(stage, event); latestStage = stage; }
  }
  const state = shipment.lastMileState || shipment.movementState || shipment.currentStatus || shipment.status;
  const operationalState = shipment.lastMileState || shipment.movementState;
  const current = stageByStatus[operationalState] ?? Math.max(stageByStatus[shipment.currentStatus || shipment.status] ?? 0, latestStage);
  if (!evidence.has(current)) evidence.set(current, { location: shipment.currentLocation, timestamp: current === 6 ? shipment.deliveredAt : current === 4 ? shipment.destinationInwardAt || shipment.receivedAt : undefined });
  const cancelled = (shipment.currentStatus || shipment.status) === 'CANCELLED';
  const hold = ['QC_HOLD', 'HOLD', 'DELIVERY_FAILED'].includes(state);
  const stageTitle = cancelled ? 'Shipment cancelled' : state === 'DELIVERY_FAILED' ? 'Delivery attempt failed' : state === 'QC_HOLD' || state === 'HOLD' ? 'Shipment on hold' : state === 'POD_UPLOADED' ? 'POD uploaded - closure pending' : state === 'DESTINATION_INWARDED' ? 'Ready for delivery at branch' : journeyStages[current].title;
  return { current, cancelled, hold, stageTitle, latest: scans.at(-1), stages: journeyStages.map((stage, index) => ({ ...stage, evidence: evidence.get(index), state: cancelled ? 'cancelled' : index === current ? 'current' : evidence.has(index) ? 'recorded' : index < current ? 'unrecorded' : 'pending' })) };
}
