import { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { pickupRunSheetsApi } from '../api/services';
import { errorMessage } from '../api/client';
import TransportPdfDownload from '../components/tms/TransportPdfDownload';
import { ErrorState, Loadingcrleleton, PageHeader, StatusBadge } from '../components/common/UI';
import { useAuth } from '../features/auth/AuthContext';
import { date, idOf, label } from '../lib/workflow';

const entryFor = (prs, request) => prs.purEntries?.find((entry) => idOf(entry.pickupRequestId) === idOf(request));

export default function PickupRunSheetDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const base = `/${user.role.toLowerCase()}`;
  const printRef = useRef(null);
  const query = useQuery({ queryKey: ['pickup-run-sheet', id], queryFn: () => pickupRunSheetsApi.detail(id) });
  if (query.isPending) return <Loadingcrleleton />;
  if (query.isError) return <ErrorState error={errorMessage(query.error)} retry={query.refetch} />;
  const prs = query.data.data;
  return (
    <>
      <PageHeader title={prs.prsNumber} description={`${prs.route} · ${date(prs.pickupDate)}`}>
        <Link className="btn secondary" to={`${base}/pickup-run-sheets`}>Back to PRS</Link>
        <button className="btn secondary" onClick={() => window.print()}><Printer size={16} /> Print PRS</button>
        <TransportPdfDownload targetRef={printRef} documentNumber={prs.dispatchId || prs.prsNumber} label="Download PRS PDF" />
        <StatusBadge status={prs.status} />
      </PageHeader>

      <div className="transport-document-shell" ref={printRef}>
        <div className="transport-print-document prs-document">
          <header className="prs-brand"><img src="/crl-logo.png" alt="CRL" /><div><h1>CHAPLE ROADLINES PVT. LTD.</h1><span>First Mile Operations</span></div><strong>PICKUP RUN SHEET</strong></header>
          <section className="prs-number-row"><div><small>PRS Number</small><b>{prs.prsNumber}</b></div><div><small>Dispatch ID</small><b>{prs.dispatchId || 'DRAFT'}</b></div><div><small>Pickup Date</small><b>{date(prs.pickupDate)}</b></div></section>
          <section className="prs-info-grid"><div><small>Vendor</small><b>{prs.vendorCode} · {prs.vendorName}</b></div><div><small>Vendor / Rate type</small><b>{label(prs.vendorCategory)} · {label(prs.rateSource)}</b></div><div><small>Vendor payable</small><b>₹ {Number(prs.vendorPayableAmount || 0).toLocaleString('en-IN')}</b></div><div><small>Field Executive</small><b>{prs.fieldExecutiveName} · {prs.fieldExecutiveMobile}</b></div><div><small>Vehicle</small><b>{prs.vehicleNumber} · {prs.vehicleType}</b></div><div><small>Route</small><b>{prs.route}</b></div></section>
          <table className="prs-table"><thead><tr><th>Sr.</th><th>PUR / LR</th><th>Pickup from</th><th>Deliver to</th><th>Payment</th><th>Boxes</th><th>Weight</th><th>Pickup acknowledgement</th></tr></thead><tbody>{prs.pickupRequestIds.map((request, index) => { const entry = entryFor(prs, request); return <tr key={idOf(request)}><td>{index + 1}</td><td><b>{request.pickupRequestNumber}</b><span>{request.shipmentId?.lrNumber}</span></td><td><b>{request.shipper?.companyName}</b><span>{request.shipper?.address}, {request.shipper?.city} - {request.shipper?.pincode}</span><span>{request.shipper?.contactName} · {request.shipper?.contactMobile}</span></td><td><b>{request.recipient?.companyName}</b><span>{request.recipient?.address}, {request.recipient?.city} - {request.recipient?.pincode}</span></td><td><b>{label(entry?.paymentTerm)}</b><span>₹ {Number(entry?.amount || 0).toLocaleString('en-IN')}</span></td><td>{request.totalBoxes}</td><td>{request.totalWeightKg} kg</td><td><span>Time: __________</span><span>Sign: __________</span></td></tr>; })}</tbody></table>
          {prs.remarks && <p className="prs-remarks"><b>Remarks:</b> {prs.remarks}</p>}
          <footer className="prs-signatures"><div><span>Prepared by</span><b>{prs.createdBy?.name || 'CRL Operations'}</b></div><div><span>Driver / FE signature</span><b>____________________</b></div><div><span>Operations approval</span><b>____________________</b></div></footer>
        </div>
      </div>
    </>
  );
}
