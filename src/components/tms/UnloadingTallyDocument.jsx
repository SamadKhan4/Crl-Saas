import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { tripsApi } from '../../api/services';
import { errorMessage } from '../../api/client';
import { date, idOf } from '../../lib/workflow';
import { ErrorState, Loadingcrleleton, Modal } from '../common/UI';

export function UnloadingTallySheet({ trip }) {
  const vendor = trip.vendorId || {};
  const shipments = trip.shipmentIds || [];
  const shipmentById = new Map(shipments.map((lr) => [idOf(lr), lr]));
  const manifests = (trip.manifestIds || []).map((manifest) => ({ ...manifest, shipmentIds: (manifest.shipmentIds || []).map((lr) => typeof lr === 'object' ? lr : shipmentById.get(idOf(lr))).filter(Boolean) }));
  const listed = new Set(manifests.flatMap((manifest) => manifest.shipmentIds.map(idOf)));
  const unlisted = shipments.filter((lr) => !listed.has(idOf(lr)));
  if (unlisted.length) manifests.push({ manifestNumber: 'Manifest reference unavailable', shipmentIds: unlisted });
  return <div className="transport-print-document tally-print-document unloading-verification-sheet">
    <header className="tally-brand"><img src="/crl-logo.png" alt="CRL" /><div><h1>CHAPLE ROADLINES PVT. LTD.</h1><span>Physical goods receipt and verification</span></div><strong>UNLOADING TALLY</strong></header>
    <section className="tally-heading"><div><small>Trip number</small><h2>{trip.tripNumber}</h2></div><div><small>Movement</small><b>{trip.origin || trip.fromHubId?.name || '-'} to {trip.destination || trip.toHubId?.name || '-'}</b><span>Receiving branch: {trip.toHubId?.name || '-'}</span></div></section>
    <section className="tally-info-grid">{[
      ['Vehicle / type', [trip.vehicleNumber, trip.vehicleType, trip.vehicleSource].filter(Boolean).join(' / ')],
      ['Driver / mobile', [trip.driverName, trip.driverMobile].filter(Boolean).join(' / ')],
      ['Seal number', trip.sealNumber],
      ['Departure', date(trip.dispatchedAt || trip.departureDate)],
      ['Arrival', date(trip.arrivedAt)],
      ['Totals', `${shipments.length} LRs / ${shipments.reduce((sum, lr) => sum + Number(lr.packageCount || 0), 0)} packages / ${Number(trip.totalWeightKg || 0)} kg`],
    ].map(([label, value]) => <div key={label}><small>{label}</small><b>{value || '-'}</b></div>)}</section>
    <section className="unloading-vendor-details">
      <div><small>Vendor / code</small><b>{[vendor.name, vendor.vendorCode, vendor.vendorType].filter(Boolean).join(' / ') || 'Market vehicle - vendor not recorded'}</b></div>
      <div><small>Vendor contact</small><b>{[vendor.contactPerson || vendor.ownerName, vendor.mobile, vendor.email].filter(Boolean).join(' / ') || '-'}</b></div>
      {vendor.gstNumber && <div className="unloading-vendor-address"><small>GST number</small><span>{vendor.gstNumber}</span></div>}
    </section>
    <div className="unloading-section-title"><h3>LR-wise physical verification</h3><span>Fill in during unloading</span></div>
    <p className="unloading-instructions">Count packages and check their condition. Record discrepancies and sign against each LR.</p>
    <table className="tally-lr-table unloading-receipt-table">
      <colgroup>{[15, 22, 6, 7, 6, 6, 7, 19, 12].map((width, index) => <col key={index} style={{ width: `${width}%` }} />)}</colgroup>
      <thead><tr><th>LR number</th><th>Parties / goods</th><th>Pkgs</th><th>Recv.</th><th>Short</th><th>Extra</th><th>Dmg.</th><th>Remarks / condition</th><th>Verified / sign</th></tr></thead>
      <tbody>{manifests.map((manifest) => <ManifestReceiptRows key={idOf(manifest) || manifest.manifestNumber} manifest={manifest} />)}</tbody>
      <tfoot><tr><td colSpan={2}>Total expected packages</td><td>{shipments.reduce((sum, lr) => sum + Number(lr.packageCount || 0), 0)}</td><td /><td /><td /><td /><td colSpan={2}>Received count verified: __________</td></tr></tfoot>
    </table>
    <section className="unloading-verification-notes">
      <div className="unloading-receipt-fields"><div><span>Unloading date / time</span><div className="unloading-write-line" /></div><div><span>Bay / location</span><div className="unloading-write-line" /></div></div>
      <div className="unloading-remarks-box"><span>Seal condition / overall remarks</span><div className="unloading-write-line" /><div className="unloading-write-line" /></div>
    </section>
    <footer className="tally-signatures"><div><span>Unloaded / counted by</span><b>Name / signature</b></div><div><span>Verified / received by</span><b>Name / signature</b></div><div><span>Driver acknowledgement</span><b>Name / signature</b></div></footer>
  </div>;
}

function ManifestReceiptRows({ manifest }) {
  return <>
    <tr className="unloading-manifest-heading"><td colSpan={9}><b>Manifest: {manifest.manifestNumber || '-'}</b> | {manifest.origin || '-'} to {manifest.destination || '-'} | {manifest.shipmentIds.length} LRs | {manifest.shipmentIds.reduce((sum, lr) => sum + Number(lr.packageCount || 0), 0)} packages</td></tr>
    {manifest.shipmentIds.map((lr) => <tr key={idOf(lr)}>
      <td><b>{lr.lrNumber}</b><small>{lr.lrDetails?.from} to {lr.lrDetails?.to}</small></td>
      <td><b>{lr.senderName || '-'}</b><small>To: {lr.receiverName || '-'}</small><small>{lr.receiverMobile}</small>{lr.lrDetails?.goods?.length ? lr.lrDetails.goods.map((goods, index) => <small key={index}>{[goods.packageNumber, goods.description, goods.packageType].filter(Boolean).join(' / ')} - {goods.quantity} packages</small>) : <small>{lr.description || '-'}</small>}<small>Weight: {lr.weightKg || 0} kg</small></td>
      <td>{lr.packageCount}</td><td /><td /><td /><td /><td /><td />
    </tr>)}
  </>;
}

export default function UnloadingTallyDocument({ tripId, autoPrint = false, onClose }) {
  const printRef = useRef(null);
  const printed = useRef(false);
  const query = useQuery({ queryKey: ['unloading-trip-document', tripId], queryFn: () => tripsApi.detail(tripId) });
  const trip = query.data?.data;
  useEffect(() => {
    if (!trip || !autoPrint || printed.current) return;
    let cancelled = false;
    const print = async () => {
      const logo = printRef.current?.querySelector('img');
      if (logo?.decode) await logo.decode().catch(() => {});
      if (!cancelled) { printed.current = true; window.print(); }
    };
    const frame = requestAnimationFrame(print);
    return () => { cancelled = true; cancelAnimationFrame(frame); };
  }, [trip, autoPrint]);
  return <Modal title={`Unloading Tally${trip ? ` - ${trip.tripNumber}` : ''}`} onClose={onClose}>
    {query.isPending ? <Loadingcrleleton /> : query.isError ? <ErrorState error={errorMessage(query.error)} retry={query.refetch} /> : <>
      <div className="actions tally-document-actions"><button className="btn secondary" onClick={() => window.print()}>Print Unloading Tally</button></div>
      <div ref={printRef} className="transport-document-shell"><UnloadingTallySheet trip={trip} /></div>
    </>}
  </Modal>;
}
