import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, ArrowRight, CheckCircle2, ShieldCheck } from 'lucide-react';
import { publicApi } from '../api/services';
import { errorMessage } from '../api/client';
import { Brand } from '../components/layout/AppLayout';
import {
  Loadingcrleleton,
  ErrorState,
  StatusBadge,
  ShipmentTimeline,
  ActivityTimeline,
} from '../components/common/UI';
import FileUploader from '../components/forms/FileUploader';
import { date } from '../lib/workflow';
export default function PublicPage() {
  const { token } = useParams();
  return (
    <div className="public-page">
      <header>
        <Brand />
        <Link className="btn secondary" to="/login">
          Team sign in <ArrowRight size={16} />
        </Link>
      </header>
      <main>{token ? <PublicUpload token={token} /> : <Tracking />}</main>
      <footer>
        <ShieldCheck size={16} /> SK Logistic · Keeping you connected to every mile.
      </footer>
    </div>
  );
}
function Tracking() {
  const [input, setInput] = useState(''),
    [lr, setLr] = useState('');
  const query = useQuery({
    queryKey: ['public-tracking', lr],
    queryFn: () => publicApi.track(lr),
    enabled: !!lr,
    retry: false,
  });
  const data = query.data?.data;
  return (
    <>
      <div className="public-heading">
        <span className="eyebrow">FROM OUR BRANCH TO YOUR DOOR</span>
        <h1>Every mile. In sight.</h1>
        <p>Enter your LR number to see the latest shipment update.</p>
      </div>
      <section className="panel public-search">
        <form
          className="tracking-form"
          onSubmit={(e) => {
            e.preventDefault();
            setLr(input.trim().toUpperCase());
          }}
        >
          <Search size={22} />
          <label className="sr-only" htmlFor="tracking-lr">
            LR number
          </label>
          <input
            id="tracking-lr"
            placeholder="Enter your LR number"
            value={input}
            required
            minLength={1}
            maxLength={50}
            onChange={(e) => setInput(e.target.value)}
          />
          <button className="btn">
            Track shipment <ArrowRight size={16} />
          </button>
        </form>
      </section>
      {lr &&
        (query.isPending ? (
          <Loadingcrleleton />
        ) : query.isError ? (
          <ErrorState error={errorMessage(query.error)} retry={query.refetch} />
        ) : (
          <section className="panel form-section">
            <div className="panel-heading">
              <h2>{data.lrNumber}</h2>
              <StatusBadge status={data.status} />
            </div>
            <div className="summary-grid">
              {[
                ['Origin', data.origin],
                ['Destination', data.destination],
                ['Current location', data.currentLocation],
                ['Booked', date(data.bookingDate)],
                ['Expected delivery', date(data.expectedDeliveryDate)],
              ].map(([key, value]) => (
                <div key={key}>
                  <small>{key}</small>
                  <strong>{value || '—'}</strong>
                </div>
              ))}
            </div>
            <ShipmentTimeline status={data.status} />
            <h3>Tracking history</h3>
            <ActivityTimeline events={data.trackingHistory} />
          </section>
        ))}
      <div className="public-note">Your LR number is printed on your booking receipt.</div>
      <Link className="public-note" to="/request-upload">
        Need to submit a signed LR? Request an upload link →
      </Link>
    </>
  );
}
function PublicUpload({ token }) {
  const [success, setSuccess] = useState(false);
  if (!/^[a-f\d]{64}$/i.test(token))
    return <ErrorState error="This upload link is invalid. Acrl your crl  branch for a new link." />;
  return (
    <>
      <div className="public-heading">
        <span className="eyebrow">SECURE DOCUMENT SUBMISSION</span>
        <h1>One final document.</h1>
        <p>Upload your signed LR. No account needed.</p>
      </div>
      <section className="panel upload-panel">
        {success ? (
          <div className="empty">
            <CheckCircle2 size={45} />
            <h2>Upload successful</h2>
            <p>Your document is pending verification.</p>
            <Link className="btn secondary" to="/track">
              Track a shipment
            </Link>
          </div>
        ) : (
          <>
            <FileUploader
              onUpload={(body, progress) => publicApi.upload(token, body, progress)}
              onSuccess={() => setSuccess(true)}
            />
            <p className="public-note">
              This link is valid for one upload only. If it has expired or already been used,
              request a new link from your crl  branch.
            </p>
          </>
        )}
      </section>
    </>
  );
}
export function RequestUploadPage() {
  const [result, setResult] = useState(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <div className="public-page">
      <header>
        <Brand />
        <Link to="/track">Track shipment</Link>
      </header>
      <main>
        <div className="public-heading">
          <h1>Submit your signed LR.</h1>
          <p>Use the customer code and LR number on your receipt.</p>
        </div>
        <section className="panel upload-panel">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError('');
              const form = new FormData(e.currentTarget);
              try {
                setResult(
                  (
                    await publicApi.request({
                      customerCode: form.get('customerCode').trim().toUpperCase(),
                      lrNumber: form.get('lrNumber').trim().toUpperCase(),
                    })
                  ).data,
                );
              } catch (err) {
                setError(errorMessage(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Customer code
              <input name="customerCode" required minLength={6} maxLength={30} />
            </label>
            <label>
              LR number
              <input name="lrNumber" required minLength={1} maxLength={50} />
            </label>
            {error && (
              <p role="alert" className="field-error">
                {error}
              </p>
            )}
            <button className="btn" disabled={busy}>
              {busy ? 'Checking…' : 'Request upload link'}
            </button>
          </form>
          {result &&
            (result.uploadToken ? (
              <Link className="btn secondary" to={`/upload-lr/${result.uploadToken}`}>
                Continue to secure upload
              </Link>
            ) : (
              <p>
                If your shipment is eligible, an upload session can be created. Please check your
                details or contact your crl  branch.
              </p>
            ))}
        </section>
      </main>
    </div>
  );
}
