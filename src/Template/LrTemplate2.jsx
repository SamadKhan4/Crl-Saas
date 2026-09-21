import { forwardRef } from 'react';
import LrBarcode from './LrBarcode';

const show = (value) => (value === 0 || value ? String(value) : '-');
const branch = (value) => value?.name || value?.city || show(value);
const label = (value) => String(value || '').replaceAll('_', ' ');
const date = (value) => {
  if (!value || Number.isNaN(new Date(value).getTime())) return '-';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
};
const dateTime = (value) => {
  if (!value || Number.isNaN(new Date(value).getTime())) return '-';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
};
const money = (value) => `Rs. ${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

function Field({ title, value, wide = false }) {
  return (
    <div className={`lr2-field${wide ? ' lr2-wide' : ''}`}>
      <span>{title}</span>
      <strong>{show(value)}</strong>
    </div>
  );
}

function Check({ title, active }) {
  return (
    <span className={`lr2-check${active ? ' active' : ''}`}>
      <i><b>{active ? 'X' : ''}</b></i>
      <em>{title}</em>
    </span>
  );
}

const LrTemplate2 = forwardRef(function LrTemplate2({ shipment = {} }, ref) {
  const s = { ...shipment, ...(shipment.lrDetails || {}) };
  const customer = typeof s.customerId === 'object' ? s.customerId : s.customer || {};
  const goods = s.goods?.length
    ? s.goods
    : [{
        packageNumber: s.packageNumber || s.packageCount,
        description: s.description,
        packageType: s.packageType,
        actualWeight: s.actualWeight ?? s.weightKg,
        chargedWeight: s.chargedWeight,
        dimensions: s.dimensions,
        volume: s.volume,
      }];
  const declaredValue = s.declaredValue ?? 0;
  const chargeRows = [
    ['Freight', s.freightCharges],
    ['Fuel', s.fuelCharges],
    ['Handling', s.handlingCharges],
    ['FOD', s.fodCharges],
    ['COD', s.codCharges],
    ['ROV', s.rovCharges],
    ['Docket', s.docketCharges],
  ];
  const subtotal = Math.max(0, Number(s.totalAmount || 0) - Number(s.gstAmount || 0));

  return (
    <div ref={ref} className="lr-print-root lr-system-template" style={{ width: 1000, background: '#fff', color: '#000' }}>
      <style>{`
        .lr-system-template,.lr-system-template *{box-sizing:border-box}
        .lr-system-template{font-family:Arial,sans-serif;padding:22px;font-size:11px}
        .lr-system-template .lr2-shell{border:1.5px solid #172033;border-radius:8px;overflow:hidden}
        .lr-system-template .lr2-header{display:grid;grid-template-columns:1.45fr .8fr;background:#eef6f3;border-bottom:1.5px solid #172033}
        .lr-system-template .lr2-brand{display:flex;align-items:center;gap:20px;padding:16px 18px;border-right:1px solid #b9c6c2}
        .lr-system-template .lr2-brand img{width:116px;height:54px;object-fit:contain;flex:none}
        .lr-system-template .lr2-brand h1{font-size:22px;line-height:1;margin:0 0 7px;color:#0f5f4d;letter-spacing:.2px}
        .lr-system-template .lr2-brand p{font-size:10px;line-height:1.45;margin:0;color:#000}
        .lr-system-template .lr2-number{padding:10px 18px;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center}
        .lr-system-template .lr2-number span{font-size:9px;letter-spacing:1.5px;font-weight:700;color:#000}
        .lr-system-template .lr2-number strong{font-size:25px;color:#172033;margin:5px 0 7px;overflow-wrap:anywhere}
        .lr-system-template .lr2-number .lr2-barcode{display:block;width:100%;max-width:285px;height:54px;margin:4px auto 3px}
        .lr-system-template .lr2-number small{font-size:10px;color:#000}
        .lr-system-template .lr2-route{display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid #cbd5e1;background:#172033;color:#fff}
        .lr-system-template .lr2-route div{padding:8px 18px}.lr-system-template .lr2-route div:last-child{text-align:right}
        .lr-system-template .lr2-route span{display:block;font-size:8px;letter-spacing:1.2px;color:#a7f3d0;margin-bottom:2px}
        .lr-system-template .lr2-route strong{font-size:15px}
        .lr-system-template .lr2-section{border-bottom:1px solid #cbd5e1}
        .lr-system-template .lr2-title{padding:5px 10px;background:#f1f5f9;border-bottom:1px solid #cbd5e1;color:#0f5f4d;font-size:9px;font-weight:800;letter-spacing:1px;text-transform:uppercase}
        .lr-system-template .lr2-raised-title{display:inline-block;position:relative;top:-4px}
        .lr-system-template .lr2-grid{display:grid;grid-template-columns:repeat(4,1fr)}
        .lr-system-template .lr2-field{min-height:41px;padding:6px 9px;border-right:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;overflow:hidden}
        .lr-system-template .lr2-field:nth-child(4n){border-right:0}.lr-system-template .lr2-field.lr2-wide{grid-column:span 2}
        .lr-system-template .lr2-field span{display:block;font-size:8px;text-transform:uppercase;letter-spacing:.6px;color:#000;font-weight:700;margin-bottom:4px}
        .lr-system-template .lr2-field strong{display:block;font-size:10px;line-height:1.3;overflow-wrap:anywhere}
        .lr-system-template .lr2-parties{display:grid;grid-template-columns:1fr 1fr}.lr-system-template .lr2-party:first-child{border-right:1px solid #cbd5e1}
        .lr-system-template .lr2-party-head{padding:6px 10px;background:#f1f5f9;color:#0f5f4d;font-size:9px;font-weight:800;letter-spacing:1px;}
        .lr-system-template .lr2-party-head span{display:inline-block;position:relative;top:-4px}
        .lr-system-template .lr2-party-body{display:grid;grid-template-columns:1fr 1fr}
        .lr-system-template .lr2-party-body .lr2-field:nth-child(2n){border-right:0}
        .lr-system-template table{width:100%;border-collapse:separate;border-spacing:0;table-layout:fixed}
        .lr-system-template .lr2-goods-section .lr2-title{border-bottom:0}
        .lr-system-template th{background:#172033;color:#fff;padding:6px 4px;font-size:8px;line-height:1.25;border-right:1px solid #475569}
        .lr-system-template th span{display:inline-block;position:relative;top:-3px}
        .lr-system-template td{padding:6px 4px;text-align:center;font-size:9px;line-height:1.25;border-right:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;overflow-wrap:anywhere}
        .lr-system-template td span{display:inline-block;position:relative;top:-5px}
        .lr-system-template tbody tr:last-child td{border-bottom:1.5px solid #172033}
        .lr-system-template th:last-child,.lr-system-template td:last-child{border-right:0}
        .lr-system-template .lr2-totals{display:grid;grid-template-columns:repeat(5,1fr);background:#f8fafc}
        .lr-system-template .lr2-total{padding:6px 8px;border-right:1px solid #e2e8f0}.lr-system-template .lr2-total:last-child{border:0}
        .lr-system-template .lr2-total span{display:block;color:#000;font-size:8px;font-weight:700;margin-bottom:2px}.lr-system-template .lr2-total strong{font-size:11px}
        .lr-system-template .lr2-bottom{display:grid;grid-template-columns:1.2fr .9fr .9fr}
        .lr-system-template .lr2-bottom>div{border-right:1px solid #cbd5e1}.lr-system-template .lr2-bottom>div:last-child{border:0;display:flex;flex-direction:column}
        .lr-system-template .lr2-pad{padding:8px 10px}.lr-system-template .lr2-options{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px}
        .lr-system-template .lr2-check{display:flex;align-items:center;gap:4px;font-size:8px;font-weight:700;color:#000}
        .lr-system-template .lr2-check i{width:13px;height:13px;border:1px solid #94a3b8;display:flex;align-items:center;justify-content:center;font-size:8px;font-style:normal}
        .lr-system-template .lr2-check i b{position:relative;top:-4px}
        .lr-system-template .lr2-check em{position:relative;top:-5px;font-style:normal}
        .lr-system-template .lr2-check.active{color:#0f5f4d}.lr-system-template .lr2-check.active i{border-color:#0f5f4d;background:#dcfce7}
        .lr-system-template .lr2-charges{display:grid;grid-template-columns:1fr 1fr}.lr-system-template .lr2-charge{padding:4px 7px;border-right:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:8px}
        .lr-system-template .lr2-subtotal{grid-column:span 2;padding:5px 9px;border-bottom:1px solid #cbd5e1;display:flex;justify-content:space-between;font-size:9px;font-weight:800}
        .lr-system-template .lr2-grand{grid-column:span 2;background:#0f5f4d;color:#fff;padding:7px 9px;display:flex;justify-content:space-between;font-size:11px;font-weight:800}
        .lr-system-template .lr2-signatures{display:grid;grid-template-columns:1fr 1fr;min-height:89px;flex:1}.lr-system-template .lr2-signatures>div{padding:7px 9px;border-right:1px solid #e2e8f0}.lr-system-template .lr2-signatures>div:last-child{border:0}
        .lr-system-template .lr2-signatures span{font-size:8px;color:#000;font-weight:700;display:block}.lr-system-template .lr2-signatures strong{font-size:9px;display:block;margin-top:4px;overflow-wrap:anywhere}
        .lr-system-template .lr2-footer{padding:6px 10px;background:#172033;color:#fff;display:flex;justify-content:space-between;font-size:8px}
      `}</style>
      <div className="lr2-shell">
        <header className="lr2-header">
          <div className="lr2-brand">
            <img src="/crl-logo.png" alt="Chaple Roadlines logo" width="116" height="54" />
            <div>
              <h1>CHAPLE ROADLINES PVT. LTD.</h1>
              <p>Shop No. 3, Opp. Joshi Clinic, Beside Pushpa Mobile, Wadi, Nagpur - 440023 (MH.)</p>
              <p>Mobile: 7499358403 | info@crl-transport.com | www.crl-transport.com</p>
              <p>GST: 27AANCC4313N1ZC | PAN: AANCC4313N | Transporter ID: 27AANCC4313N1ZC</p>
            </div>
          </div>
          <div className="lr2-number">
            <span>SYSTEM GENERATED CONSIGNMENT NOTE</span>
            <LrBarcode value={s.lrNumber} className="lr2-barcode" />
            <small>Booking: {date(s.bookingDate || s.createdAt)} &nbsp; | &nbsp; Expected: {date(s.expectedDeliveryDate)}</small>
          </div>
        </header>

        <div className="lr2-route">
          <div><span>FROM</span><strong>{show(s.from || branch(s.originBranchId))}</strong></div>
          <div><span>TO</span><strong>{show(s.to || branch(s.destinationBranchId))}</strong></div>
        </div>

        <section className="lr2-parties lr2-section">
          <div className="lr2-party">
            <div className="lr2-party-head"><span>CONSIGNOR DETAILS</span></div>
            <div className="lr2-party-body">
              <Field title="Consignor code" value={s.consignorCode || customer.customerCode} />
              <Field title="Name" value={s.senderName || customer.name} />
              <Field title="Address line 1" value={s.consignorAddress || customer.address} wide />
              <Field title="Address line 2" value={s.consignorAddress2} wide />
              <Field title="PIN code" value={s.consignorPincode || customer.pincode} />
              <Field title="GSTIN" value={s.consignorGstin || customer.gstNumber} />
            </div>
          </div>
          <div className="lr2-party">
            <div className="lr2-party-head"><span>CONSIGNEE DETAILS</span></div>
            <div className="lr2-party-body">
              <Field title="Name" value={s.receiverName} />
              <Field title="Mobile" value={s.receiverMobile} />
              <Field title="Address line 1" value={s.consigneeAddress} wide />
              <Field title="Address line 2 / 3" value={[s.consigneeAddress2, s.consigneeAddress3].filter(Boolean).join(', ')} wide />
              <Field title="PIN code" value={s.consigneePincode} />
              <Field title="GSTIN" value={s.consigneeGstin} />
            </div>
          </div>
        </section>

        <section className="lr2-section">
          <div className="lr2-title"><span className="lr2-raised-title">Booking, delivery and references</span></div>
          <div className="lr2-grid">
            <Field title="Booking branch" value={s.bookingBranch || branch(s.originBranchId)} />
            <Field title="Delivery address" value={s.deliveryAddress} wide />
            <Field title="Contact number" value={s.contactNo || s.receiverMobile} />
            <Field title="Invoice number" value={s.invoiceNo} />
            <Field title="Invoice date" value={date(s.invoiceDate)} />
            <Field title="E-Way Bill number" value={s.eWayBillNo} />
            <Field title="E-Way Bill date" value={date(s.eWayBillDate)} />
            <Field title="PO / STN number" value={s.poStnNo} wide />
            <Field title="Customer reference" value={s.customerReference} wide />
          </div>
        </section>

        <section className="lr2-section lr2-goods-section">
          <div className="lr2-title"><span className="lr2-raised-title">Goods details</span></div>
          <table>
            <thead>
              <tr>
                <th style={{ width: '8%' }}><span>Pkg. No.</span></th>
                <th style={{ width: '23%' }}><span>Description of goods</span></th>
                <th style={{ width: '11%' }}><span>Package type</span></th>
                <th style={{ width: '8%' }}><span>Qty</span></th>
                <th style={{ width: '10%' }}><span>Actual kg</span></th>
                <th style={{ width: '10%' }}><span>Charged kg</span></th>
                <th style={{ width: '18%' }}><span>L x B x H / Unit</span></th>
                <th style={{ width: '12%' }}><span>Volume CFT</span></th>
              </tr>
            </thead>
            <tbody>
              {goods.map((row, index) => (
                <tr key={`${row.packageNumber || index}-${index}`}>
                  <td><span>{show(row.packageNumber || index + 1)}</span></td>
                  <td><span>{show(row.description)}</span></td>
                  <td><span>{show(row.packageType)}</span></td>
                  <td><span>{show(row.quantity)}</span></td>
                  <td><span>{show(row.actualWeight)}</span></td>
                  <td><span>{show(row.chargedWeight)}</span></td>
                  <td><span>{show(row.length ? `${row.length} x ${row.breadth} x ${row.height} ${row.dimensionUnit}` : row.dimensions)}</span></td>
                  <td><span>{show(row.volume)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="lr2-totals">
            <div className="lr2-total"><span>Total packages</span><strong>{show(s.packageCount)}</strong></div>
            <div className="lr2-total"><span>Actual weight</span><strong>{show(s.actualWeight ?? s.weightKg)} kg</strong></div>
            <div className="lr2-total"><span>Volumetric weight</span><strong>{show(s.volumetricWeight)} kg</strong></div>
            <div className="lr2-total"><span>Chargeable weight</span><strong>{show(s.chargedWeight)} kg</strong></div>
            <div className="lr2-total"><span>Declared value</span><strong>{money(declaredValue)}</strong></div>
          </div>
        </section>

        <section className="lr2-bottom">
          <div>
            <div className="lr2-title">Payment, risk and pricing</div>
            <div className="lr2-pad">
              <div className="lr2-options">
                {['PAID', 'TO_PAY', 'CREDIT'].map((item) => <Check key={item} title={label(item)} active={s.paymentMode === item} />)}
                {['CARRIER_RISK', 'OWNER_RISK'].map((item) => <Check key={item} title={label(item)} active={s.riskType === item} />)}
                {['INSURED', 'NOT_INSURED'].map((item) => <Check key={item} title={label(item)} active={s.insuranceType === item} />)}
              </div>
            </div>
            <div className="lr2-title">Remarks</div>
            <div className="lr2-pad">{show(s.remarks)}</div>
          </div>
          <div>
            <div className="lr2-title">Charges</div>
            <div className="lr2-charges">
              {chargeRows.map(([title, value]) => <div className="lr2-charge" key={title}><span>{title}</span><b>{money(value)}</b></div>)}
              {s.fodCodCharges != null && s.fodCharges == null && s.codCharges == null && <div className="lr2-charge"><span>FOD / COD</span><b>{money(s.fodCodCharges)}</b></div>}
              <div className="lr2-subtotal"><span>SUB TOTAL</span><span>{money(subtotal)}</span></div>
              <div className="lr2-subtotal"><span>GST ({show(s.gstRate)}%)</span><span>{money(s.gstAmount)}</span></div>
              <div className="lr2-grand"><span>TOTAL</span><span>{money(s.totalAmount)}</span></div>
            </div>
          </div>
          <div>
            <div className="lr2-title">Acknowledgement</div>
            <div className="lr2-signatures">
              <div>
                <span>Shipper signature</span><strong>{show(s.shipperSignature)}</strong>
              </div>
              <div>
                <span>Receiver name</span><strong>{show(s.receiverNamePrint || s.receiverName)}</strong>
                <span>Mobile</span><strong>{show(s.receiverMobilePrint || s.receiverMobile)}</strong>
                <span>Date &amp; time</span><strong>{dateTime(s.receiverDateTime)}</strong>
                <span>Signature</span><strong>{show(s.receiverSignature)}</strong>
              </div>
            </div>
          </div>
        </section>

        <footer className="lr2-footer">
          <span>Goods are accepted subject to the terms and conditions of Chaple Roadlines Pvt. Ltd.</span>
          <strong>Computer-generated LR</strong>
        </footer>
      </div>
    </div>
  );
});

export default LrTemplate2;
