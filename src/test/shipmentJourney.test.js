import { expect, it } from 'vitest';
import { shipmentJourney } from '../lib/shipmentJourney';

it('uses operational LR movement ahead of document status', () => {
  const journey = shipmentJourney({ currentStatus: 'LR_IMAGE_UPLOADED', lastMileState: 'OUT_FOR_DELIVERY' });
  expect(journey.current).toBe(5);
  expect(journey.stages[6].state).toBe('pending');
  expect(journey.stages[1].state).toBe('unrecorded');
});

it('never equates legacy closed or completed records with delivered goods', () => {
  expect(shipmentJourney({ currentStatus: 'CLOSED' }).current).toBe(0);
  expect(shipmentJourney({ currentStatus: 'COMPLETED' }).stages[6].state).toBe('pending');
});

it('shows recorded milestone timestamps and locations from unordered events', () => {
  const journey = shipmentJourney({ currentStatus: 'IN_TRANSIT' }, [
    { status: 'RECEIVED', timestamp: '2026-10-26T10:00:00Z', location: 'Destination branch' },
    { status: 'PICKED_UP', timestamp: '2026-10-25T10:00:00Z', location: 'Origin' },
  ]);
  expect(journey.current).toBe(4);
  expect(journey.stages[1]).toMatchObject({ state: 'recorded', evidence: { location: 'Origin' } });
  expect(journey.stages[2].state).toBe('unrecorded');
});

it('shows failed deliveries and the return to branch for another DRS', () => {
  expect(shipmentJourney({ lastMileState: 'DELIVERY_FAILED' })).toMatchObject({ hold: true, current: 5, stageTitle: 'Delivery attempt failed' });
  const returned = shipmentJourney({ lastMileState: 'DESTINATION_INWARDED' }, [{ status: 'DELIVERY_FAILED' }]);
  expect(returned.current).toBe(4);
  expect(returned.stageTitle).toBe('Ready for delivery at branch');
});

it('requires delivery confirmation rather than just POD upload', () => {
  expect(shipmentJourney({ lastMileState: 'POD_UPLOADED' }).current).toBe(5);
  expect(shipmentJourney({ lastMileState: 'DELIVERED', deliveredAt: '2026-10-26' }).current).toBe(6);
});

it('handles cancelled shipments without a completed journey', () => {
  const journey = shipmentJourney({ currentStatus: 'CANCELLED' });
  expect(journey.cancelled).toBe(true);
  expect(journey.stages.every((stage) => stage.state === 'cancelled')).toBe(true);
});
