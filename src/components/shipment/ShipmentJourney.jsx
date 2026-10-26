import { Check, Clock3, MapPin, PackageCheck, Package, Truck, Warehouse, ClipboardCheck, CircleAlert } from 'lucide-react';
import { shipmentJourney } from '../../lib/shipmentJourney';

const icons = [Package, PackageCheck, Warehouse, Truck, Warehouse, Truck, ClipboardCheck];
const timestamp = (value) => value && !Number.isNaN(new Date(value).getTime()) ? new Date(value).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : null;

export default function ShipmentJourney({ shipment, events = [], loading = false, error = false }) {
  const journey = shipmentJourney(shipment, events);
  const lastUpdate = timestamp(journey.latest?.timestamp || journey.latest?.createdAt);
  return <section className={`lr-journey${journey.hold || journey.cancelled ? ' needs-attention' : ''}`} aria-label="LR tracking journey">
    <header className="lr-journey-header"><div><span className="lr-journey-eyebrow">LR TRACKING</span><h2>{journey.stageTitle}</h2><p><MapPin size={14} />{shipment.currentLocation || journey.stages[journey.current].evidence?.location || 'Location not recorded'}</p></div><div className="lr-journey-updated"><Clock3 size={15} /><span>{loading ? 'Loading tracking scans...' : error ? 'Tracking history unavailable' : lastUpdate ? <>Last update<strong>{lastUpdate}</strong></> : 'Awaiting tracking scans'}</span></div></header>
    {(journey.hold || journey.cancelled) && <p className="lr-journey-alert"><CircleAlert size={16} />{journey.cancelled ? 'This shipment has been cancelled.' : journey.latest?.remarks || 'This LR needs attention. Check Tracking History for the latest details.'}</p>}
    <ol className="lr-journey-stages" aria-label="Shipment journey milestones">{journey.stages.map((stage, index) => {
      const Icon = stage.state === 'recorded' ? Check : icons[index];
      const time = timestamp(stage.evidence?.timestamp || stage.evidence?.createdAt);
      return <li key={stage.title} className={stage.state} aria-current={stage.state === 'current' ? 'step' : undefined}><span className="lr-journey-marker"><Icon size={18} /></span><div><b>{stage.title}</b><span>{stage.description}</span>{time ? <time>{time}</time> : <small>{stage.state === 'current' ? 'Current stage' : stage.state === 'unrecorded' ? 'No scan recorded' : stage.state === 'recorded' ? 'Recorded' : stage.state === 'cancelled' ? 'Cancelled' : 'Pending'}</small>}{stage.evidence?.location && <small className="lr-journey-location">{stage.evidence.location}</small>}</div></li>;
    })}</ol>
    <div className="lr-journey-footer"><span><i /> Recorded</span><span><i /> Current stage</span><span><i /> Pending / no scan</span><p>LR documents and POD are tracked separately from goods movement.</p></div>
  </section>;
}
