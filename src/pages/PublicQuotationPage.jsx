import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { publicApi } from '../api/services';
import { errorMessage } from '../api/client';
import { Brand } from '../components/layout/AppLayout';
import { FormField } from '../components/common/UI';

export default function PublicQuotationPage() {
  const [result, setResult] = useState(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      const response = await publicApi.quotation(
        Object.fromEntries([...form].filter(([, value]) => String(value).trim() !== '')),
      );
      setResult(response.data);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="public-page">
      <header>
        <Brand />
        <div className="actions">
          <Link to="/track">Track shipment</Link>
          <Link to="/login">Staff login</Link>
        </div>
      </header>
      <main className="quotation-public">
        <Link className="table-action" to="/track">
          <ArrowLeft size={16} /> Back to tracking
        </Link>
        {result ? (
          <section className="public-card public-success">
            <CheckCircle2 size={42} />
            <h1>Quotation request received</h1>
            <p>
              Reference <b>{result.quotationNumber}</b>. CRL’s commercial team can now review the
              lane and cargo details.
            </p>
            <Link className="btn" to="/track">
              Track a shipment
            </Link>
          </section>
        ) : (
          <section className="public-card">
            <span className="eyebrow">CRL / GET QUOTATION</span>
            <h1>Tell us what you need to move.</h1>
            <p>
              Share accurate cargo and route details. Final pricing remains subject to
              serviceability and physical verification.
            </p>
            <form onSubmit={submit}>
              <div className="form-grid">
                <FormField required name="leadName" label="Contact name" />
                <FormField name="companyName" label="Company" />
                <FormField required name="mobile" label="Mobile" type="tel" />
                <FormField name="email" label="Email" type="email" />
                <FormField required name="origin" label="Pickup location" />
                <FormField required name="destination" label="Delivery location" />
                <FormField
                  required
                  name="packageCount"
                  label="Packages"
                  type="number"
                  min="1"
                  defaultValue="1"
                />
                <FormField
                  required
                  name="weightKg"
                  label="Approx. weight (kg)"
                  type="number"
                  min="0.01"
                  step="any"
                />
                <div className="field tms-span-2">
                  <label htmlFor="goodsDescription">Goods description</label>
                  <textarea
                    required
                    id="goodsDescription"
                    name="goodsDescription"
                    maxLength="500"
                  />
                </div>
              </div>
              {error && (
                <p className="field-error" role="alert">
                  {error}
                </p>
              )}
              <button className="btn" disabled={busy}>
                {busy ? 'Submitting…' : 'Request quotation'}
              </button>
            </form>
          </section>
        )}
      </main>
    </div>
  );
}
