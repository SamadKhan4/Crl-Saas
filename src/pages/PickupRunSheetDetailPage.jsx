import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, Plus, Printer, Send } from 'lucide-react';
import { toast } from 'sonner';
import { pickupRequestsApi, pickupRunSheetsApi } from '../api/services';
import { errorMessage } from '../api/client';
import TransportPdfDownload from '../components/tms/TransportPdfDownload';
import { DataTable, ErrorState, FormField, Loadingcrleleton, PageHeader, StatusBadge } from '../components/common/UI';
import { useAuth } from '../features/auth/AuthContext';
import { date, idOf, label } from '../lib/workflow';

const entryFor = (prs, request) => prs.purEntries?.find((entry) => idOf(entry.pickupRequestId) === idOf(request));

export default function PickupRunSheetDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const base = `/${user.role.toLowerCase()}`;
  const printRef = useRef(null);
  const cache = useQueryClient();
  const [pickupRequestId, setPickupRequestId] = useState('');
  const [paymentTerm, setPaymentTerm] = useState('CREDIT');
  const [amount, setAmount] = useState('');
  const [approvalRemarks, setApprovalRemarks] = useState('');
  const [error, setError] = useState('');
  const query = useQuery({ queryKey: ['pickup-run-sheet', id], queryFn: () => pickupRunSheetsApi.detail(id) });
  const candidates = useQuery({ queryKey: ['pickup-requests', 'prs-candidates'], queryFn: () => pickupRequestsApi.list({ status: 'PENDING', limit: 100 }) });
  const refresh = () => {
    cache.invalidateQueries({ queryKey: ['pickup-run-sheet', id] });
    cache.invalidateQueries({ queryKey: ['pickup-run-sheets'] });
    cache.invalidateQueries({ queryKey: ['pickup-requests'] });
  };
  const action = useMutation({
    mutationFn: ({ type, decision }) => {
      if (type === 'add') return pickupRunSheetsApi.addPickup(id, { pickupRequestId, paymentTerm, amount });
      if (type === 'review') return pickupRunSheetsApi.review(id, { decision, remarks: approvalRemarks });
      return pickupRunSheetsApi.dispatch(id);
    },
    onSuccess: (_result, variables) => {
      toast.success(variables.type === 'add' ? 'PUR added to PRS' : variables.type === 'review' ? `Market rate ${variables.decision.toLowerCase()}` : 'PRS dispatched and client notifications queued');
      setPickupRequestId('');
      setAmount('');
      setApprovalRemarks('');
      setError('');
      refresh();
    },
    onError: (reason) => setError(errorMessage(reason)),
  });
  if (query.isPending || candidates.isPending) return <Loadingcrleleton />;
  if (query.isError || candidates.isError) return <ErrorState error={errorMessage(query.error || candidates.error)} retry={() => { query.refetch(); candidates.refetch(); }} />;
  const prs = query.data.data;
  const branchId = idOf(prs.branchId);
  const added = new Set((prs.pickupRequestIds || []).map(idOf));
  const readyPur = (candidates.data?.data || []).filter((request) => idOf(request.branchId) === branchId && request.shipmentId && !request.pickupRunSheetId && !added.has(idOf(request)));
  const selectedPur = readyPur.find((request) => idOf(request) === pickupRequestId);
  const canEdit = prs.status !== 'DISPATCHED' && prs.status !== 'CANCELLED';
  const canReview = ['ADMIN', 'MANAGER'].includes(user.role) && prs.approvalStatus === 'PENDING';
  const canDispatch = canEdit && prs.pickupRequestIds.length > 0 && !['PENDING', 'REJECTED'].includes(prs.approvalStatus);
  const totalClientAmount = (prs.purEntries || []).reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const addPur = (event) => {
    event.preventDefault();
    if (!pickupRequestId) return setError('Select a PUR.');
    action.mutate({ type: 'add' });
  };

  return (
    <>
      <PageHeader title={prs.prsNumber} description={`${prs.route} · ${date(prs.pickupDate)}`}>
        <Link className="btn secondary" to={`${base}/pickup-run-sheets`}>Back to PRS</Link>
        <button className="btn secondary" onClick={() => window.print()}><Printer size={16} /> Print PRS</button>
        <TransportPdfDownload targetRef={printRef} documentNumber={prs.dispatchId || prs.prsNumber} label="Download PRS PDF" />
        <StatusBadge status={prs.status} />
      </PageHeader>

      <div className="prs-workflow-grid">
        <section className="panel form-section">
          <div className="section-title"><span>01</span><div><h2>Vendor dispatch details</h2><p>Created from Vendor and Employee Masters.</p></div></div>
          <div className="prs-detail-grid">
            <div><small>Vendor type</small><b>{label(prs.vendorCategory)}</b></div><div><small>Vendor</small><b>{prs.vendorCode} · {prs.vendorName}</b></div>
            <div><small>Rate source</small><b>{label(prs.rateSource)} · {label(prs.rateBasis)}</b></div><div><small>Agreed / market rate</small><b>₹ {Number(prs.agreedRate || 0).toLocaleString('en-IN')}</b></div>
            <div><small>Field Executive</small><b>{prs.fieldExecutiveName} · {prs.fieldExecutiveMobile}</b></div><div><small>Vehicle</small><b>{prs.vehicleNumber} · {prs.vehicleType}</b></div>
            <div><small>Driver</small><b>{prs.driverName || prs.fieldExecutiveName} · {prs.driverMobile || prs.fieldExecutiveMobile}</b></div><div><small>Approval</small><b>{label(prs.approvalStatus)}</b></div>
          </div>
        </section>

        {canEdit && (
          <form className="panel form-section" onSubmit={addPur}>
            <div className="section-title"><span>02</span><div><h2>Add PUR</h2><p>Select a generated LR and enter client payment term and amount.</p></div></div>
            <div className="form-grid">
              <label className="full-span"><span>Pickup request *</span><select required value={pickupRequestId} onChange={(event) => setPickupRequestId(event.target.value)}><option value="">Select PUR</option>{readyPur.map((request) => <option key={idOf(request)} value={idOf(request)}>{request.pickupRequestNumber} · {request.shipmentId?.lrNumber} · {request.shipper?.companyName}</option>)}</select></label>
              <label><span>Payment term *</span><select value={paymentTerm} onChange={(event) => setPaymentTerm(event.target.value)}><option value="PAID">Paid</option><option value="PREPAID">Prepaid</option><option value="CREDIT">Credit</option></select></label>
              <FormField label="Client amount" type="number" min="0" step="0.01" required value={amount} onChange={(event) => setAmount(event.target.value)} />
            </div>
            {selectedPur && <p className="form-hint">{selectedPur.totalBoxes} boxes · {selectedPur.totalWeightKg} kg · {selectedPur.shipper.city} → {selectedPur.recipient.city}</p>}
            <button className="btn" disabled={action.isPending}><Plus size={16} /> Add PUR to sheet</button>
          </form>
        )}
      </div>

      <section className="panel">
        <div className="panel-heading"><div><h2>Added pickup requests</h2><p>{prs.pickupRequestIds.length} PUR · {prs.totalBoxes} boxes · {prs.totalWeightKg} kg</p></div></div>
        <DataTable rows={prs.pickupRequestIds} empty="No PUR added yet" columns={[
          { key: 'pickupRequestNumber', label: 'PUR number' },
          { key: 'lr', label: 'LR number', render: (row) => row.shipmentId?.lrNumber },
          { key: 'shipper', label: 'Pickup client', render: (row) => `${row.shipper?.companyName} · ${row.shipper?.city}` },
          { key: 'load', label: 'Load', render: (row) => `${row.totalBoxes} boxes · ${row.totalWeightKg} kg` },
          { key: 'payment', label: 'Payment', render: (row) => { const entry = entryFor(prs, row); return `${label(entry?.paymentTerm)} · ₹ ${Number(entry?.amount || 0).toLocaleString('en-IN')}`; } },
        ]} />
      </section>

      {prs.rateSource === 'MARKET' && (
        <section className="panel form-section">
          <div className="section-title"><span>03</span><div><h2>Market amount approval</h2><p>₹ {Number(prs.marketAmount || 0).toLocaleString('en-IN')} requires Manager/Admin approval before dispatch.</p></div><StatusBadge status={prs.approvalStatus} /></div>
          {canReview && <><FormField label="Approval remarks" required value={approvalRemarks} onChange={(event) => setApprovalRemarks(event.target.value)} /><div className="actions"><button className="btn" disabled={action.isPending || approvalRemarks.trim().length < 2} onClick={() => action.mutate({ type: 'review', decision: 'APPROVED' })}><CheckCircle2 size={16} /> Approve amount</button><button className="btn secondary" disabled={action.isPending || approvalRemarks.trim().length < 2} onClick={() => action.mutate({ type: 'review', decision: 'REJECTED' })}>Reject amount</button></div></>}
          {prs.approvalRemarks && <p className="form-hint"><b>Decision remarks:</b> {prs.approvalRemarks}</p>}
        </section>
      )}

      <section className="panel prs-dispatch-bar">
        <div><small>Vendor payable</small><strong>₹ {Number(prs.vendorPayableAmount || 0).toLocaleString('en-IN')}</strong><span>Client PUR amount: ₹ {totalClientAmount.toLocaleString('en-IN')}</span></div>
        <div><small>Dispatch ID</small><strong>{prs.dispatchId || 'Generated after dispatch'}</strong><span>Dispatch queues FE contact notification for every client.</span></div>
        {prs.status === 'DISPATCHED' ? <StatusBadge status="FIRST_MILE_COMPLETE" /> : <button className="btn" disabled={!canDispatch || action.isPending} onClick={() => action.mutate({ type: 'dispatch' })}><Send size={16} /> Dispatch PRS</button>}
      </section>
      {error && <p className="field-error" role="alert">{error}</p>}

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
