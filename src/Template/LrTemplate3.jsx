import { forwardRef } from 'react';

const show = (input) => (input === 0 || input ? String(input) : '-');
const branch = (input) => input?.name || input?.city || show(input);
const readable = (input) => String(input || '').replaceAll('_', ' ');
const date = (input, withTime = false) => {
  if (!input || Number.isNaN(new Date(input).getTime())) return '-';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(new Date(input));
};
const money = (input) => `Rs. ${Number(input || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

function Field({ label, children, wide = false }) {
  return <div className={`lr3-field${wide ? ' wide' : ''}`}><span>{label}</span><strong>{show(children)}</strong></div>;
}

function Tick({ label, active }) {
  return <span className="lr3-tick"><i><em>{active ? 'X' : ''}</em></i><b>{label}</b></span>;
}

const LrTemplate3 = forwardRef(function LrTemplate3({ shipment = {} }, ref) {
  const s = { ...shipment, ...(shipment.lrDetails || {}) };
  const customer = typeof s.customerId === 'object' ? s.customerId : s.customer || {};
  const goods = s.goods?.length ? s.goods : [{
    packageNumber: s.packageNumber || s.packageCount,
    description: s.description,
    packageType: s.packageType,
    quantity: s.packageCount,
    actualWeight: s.actualWeight ?? s.weightKg,
    chargedWeight: s.chargedWeight,
    dimensions: s.dimensions,
    volume: s.volume,
  }];
  const rows = Array.from({ length: 6 }, (_, index) => goods[index] || null);
  const subtotal = Math.max(0, Number(s.totalAmount || 0) - Number(s.gstAmount || 0));
  const charges = [
    ['Freight', s.freightCharges], ['Fuel surcharge', s.fuelCharges],
    ['Handling', s.handlingCharges], ['FOD', s.fodCharges ?? s.fodCodCharges],
    ['COD', s.codCharges], ['ROV', s.rovCharges], ['Docket', s.docketCharges],
  ];

  return (
    <div ref={ref} className="lr-print-root lr3-root" style={{ width: 1000, height: 670, background: '#fff', color: '#111' }}>
      <style>{`
        .lr3-root,.lr3-root *{box-sizing:border-box}
        .lr3-root{font-family:Arial,sans-serif;padding:10px;font-size:9px}
        .lr3-root .lr3-sheet{width:980px;height:650px;border:1.5px solid #111;overflow:hidden;background:#fff}
        .lr3-root .lr3-header{height:90px;display:grid;grid-template-columns:2.15fr .85fr;border-bottom:1px solid #111}
        .lr3-root .lr3-company{display:grid;grid-template-columns:122px 1fr;align-items:center;padding:8px 12px;border-right:1px solid #111;background:#f2f3f3}
        .lr3-root .lr3-company img{width:108px;height:48px;object-fit:contain}.lr3-root .lr3-company h1{margin:0 0 5px;font-size:21px;line-height:1;font-weight:900;letter-spacing:.4px}.lr3-root .lr3-company p{margin:0;font-size:8px;line-height:1.35;color:#111}
        .lr3-root .lr3-note{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:7px}.lr3-root .lr3-note small{font-size:7px;font-weight:900;letter-spacing:1.2px}.lr3-root .lr3-note strong{font-size:22px;line-height:1.15;margin:5px 0;overflow-wrap:anywhere}.lr3-root .lr3-note span{font-size:7px;font-weight:800}
        .lr3-root .lr3-route{height:60px;display:grid;grid-template-columns:1fr 1fr 1fr 1fr 1.1fr;border-bottom:1px solid #111;background:#f6f7f7}
        .lr3-root .lr3-route div{padding:7px 8px;border-right:1px solid #777;overflow:hidden}.lr3-root .lr3-route div:last-child{border:0}.lr3-root .lr3-route span,.lr3-root .lr3-field span{display:block;font-size:6.5px;line-height:7px;font-weight:900;text-transform:uppercase;letter-spacing:.35px;margin-bottom:4px}.lr3-root .lr3-route strong{display:block;height:27px;font-size:9px;line-height:27px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .lr3-root .lr3-body{height:445px;display:grid;grid-template-columns:36% 35% 29%;border-bottom:1px solid #111}
        .lr3-root .lr3-column{min-width:0;border-right:1px solid #111}.lr3-root .lr3-column:last-child{border:0}
        .lr3-root .lr3-title{height:24px;padding:7px 8px 5px;background:#dfe2e2;border-bottom:1px solid #111;text-align:center;font-size:8px;line-height:1;font-weight:900;letter-spacing:.8px;text-transform:uppercase}
        .lr3-root .lr3-party{height:130px;border-bottom:1px solid #111}.lr3-root .lr3-party-grid{display:grid;grid-template-columns:1fr 1fr}.lr3-root .lr3-field{height:43px;padding:7px;border-right:1px solid #aaa;border-bottom:1px solid #aaa;min-width:0;overflow:hidden}.lr3-root .lr3-field:nth-child(2n){border-right:0}.lr3-root .lr3-field.wide{grid-column:span 2;border-right:0}
        .lr3-root .lr3-field span{font-size:6px;line-height:7px;margin-bottom:3px}.lr3-root .lr3-field strong{display:block;height:18px;font-size:8px;line-height:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .lr3-root .lr3-instructions{height:137px;padding:8px}.lr3-root .lr3-instructions span{display:block;font-size:7px;font-weight:900;text-transform:uppercase;margin-bottom:7px}.lr3-root .lr3-instructions strong{font-size:9px;line-height:1.35;overflow-wrap:anywhere}
        .lr3-root .lr3-reference{height:86px;display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid #111}.lr3-root .lr3-reference .lr3-field{height:43px;padding:7px}
        .lr3-root .lr3-goods{height:168px;border-bottom:1px solid #111}.lr3-root table{width:100%;border-collapse:separate;border-spacing:0;table-layout:fixed}.lr3-root th{height:24px;padding:5px 3px;background:#eceeee;border-right:1px solid #777;border-bottom:1px solid #111;font-size:6.5px;line-height:1.1;text-align:center;text-transform:uppercase}.lr3-root th span{display:inline-block;position:relative;top:-3px;font-weight:900}.lr3-root td{height:24px;padding:5px 3px;border-right:1px solid #aaa;border-bottom:1px solid #aaa;font-size:7.5px;line-height:1.1;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.lr3-root th:last-child,.lr3-root td:last-child{border-right:0}.lr3-root tbody tr:last-child td{border-bottom:0}
        .lr3-root .lr3-summary{height:80px;display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid #111}.lr3-root .lr3-summary .lr3-field{height:40px;padding:5px 7px}
        .lr3-root .lr3-receiver{height:87px;padding:7px 8px;display:grid;grid-template-columns:1fr 1fr;gap:7px}.lr3-root .lr3-receiver>div{display:grid;grid-template-rows:8px 18px 8px 18px;row-gap:3px;align-content:start}.lr3-root .lr3-receiver span{display:block;font-size:6.5px;line-height:8px;font-weight:900;text-transform:uppercase;margin:0}.lr3-root .lr3-receiver strong{display:block;min-height:18px;font-size:8px;line-height:18px;overflow-wrap:anywhere}
        .lr3-root .lr3-service{height:46px;padding:6px 7px;border-bottom:1px solid #111;display:flex;gap:8px;align-content:center;flex-wrap:wrap}.lr3-root .lr3-tick{display:flex;align-items:center;gap:3px;font-size:6.5px;white-space:nowrap}.lr3-root .lr3-tick i{width:11px;height:11px;border:1px solid #555;display:flex;align-items:center;justify-content:center;font-size:7px;font-style:normal}.lr3-root .lr3-tick i em,.lr3-root .lr3-tick b{position:relative;top:-5px}.lr3-root .lr3-tick i em{font-style:normal}.lr3-root .lr3-tick b{font-weight:800}
        .lr3-root .lr3-charge-title{height:24px;padding:7px 7px 5px;background:#dfe2e2;border-bottom:1px solid #111;font-size:8px;line-height:1;font-weight:900;text-transform:uppercase}
        .lr3-root .lr3-charge{height:22px;padding:5px 7px;border-bottom:1px solid #888;display:grid;grid-template-columns:1fr auto;gap:5px;font-size:7.5px;line-height:11px}.lr3-root .lr3-charge strong{text-align:right}
        .lr3-root .lr3-charge.emphasis{font-weight:900;background:#f0f1f1}.lr3-root .lr3-charge.total{height:27px;padding-top:7px;background:#222;color:#fff;font-size:9px}.lr3-root .lr3-charge.total span,.lr3-root .lr3-charge.total strong{position:relative;top:-5px}
        .lr3-root .lr3-payment{height:48px;padding:6px 7px;border-bottom:1px solid #111}.lr3-root .lr3-payment>span{display:block;font-size:6.5px;font-weight:900;text-transform:uppercase;margin-bottom:6px}.lr3-root .lr3-payment div{display:flex;gap:8px;flex-wrap:wrap}
        .lr3-root .lr3-pricing{height:33px;padding:5px 7px;border-bottom:1px solid #111;font-size:6.5px;line-height:1.65}.lr3-root .lr3-insurance{height:45px;padding:7px;font-size:7px;display:flex;justify-content:space-between;gap:7px}
        .lr3-root .lr3-footer{height:55px;display:grid;grid-template-columns:1.2fr .9fr .9fr}.lr3-root .lr3-footer>div{padding:8px;border-right:1px solid #111}.lr3-root .lr3-footer>div:last-child{border:0}.lr3-root .lr3-footer span{display:block;font-size:6.5px;font-weight:900;text-transform:uppercase;margin-bottom:5px}.lr3-root .lr3-footer strong{display:block;font-size:8px;line-height:1.3;overflow-wrap:anywhere}.lr3-root .lr3-terms{font-size:7px;line-height:1.35}
      `}</style>

      <div className="lr3-sheet">
        <header className="lr3-header">
          <div className="lr3-company">
            <img src="/crl-logo.png" alt="Chaple Roadlines logo" width="108" height="48" />
            <div><h1>CHAPLE ROADLINES PVT. LTD.</h1><p>Shop No. 3, Opp. Joshi Clinic, Beside Pushpa Mobile, Wadi, Nagpur - 440023 (MH.)</p><p>Mobile: 7499358403 | info@crl-transport.com | www.crl-transport.com</p><p>GST: 27AANCC4313N1ZC | PAN: AANCC4313N | Transporter ID: 27AANCC4313N1ZC</p></div>
          </div>
          <div className="lr3-note"><small>CONSIGNMENT NOTE</small><strong>{show(s.lrNumber)}</strong><span>TRANSPORTER COPY</span></div>
        </header>

        <section className="lr3-route">
          <div><span>From</span><strong>{show(s.from || branch(s.originBranchId))}</strong></div><div><span>To</span><strong>{show(s.to || branch(s.destinationBranchId))}</strong></div>
          <div><span>Booking date</span><strong>{date(s.bookingDate || s.createdAt)}</strong></div><div><span>Expected delivery</span><strong>{date(s.expectedDeliveryDate)}</strong></div>
          <div><span>Booking branch</span><strong>{show(s.bookingBranch || branch(s.originBranchId))}</strong></div>
        </section>

        <section className="lr3-body">
          <div className="lr3-column">
            <div className="lr3-title">Consignor</div>
            <div className="lr3-party"><div className="lr3-party-grid">
              <Field label="Customer code">{s.consignorCode || customer.customerCode}</Field><Field label="Name">{s.senderName || customer.name}</Field>
              <Field label="Address" wide>{[s.consignorAddress || customer.address, s.consignorAddress2].filter(Boolean).join(', ')}</Field>
              <Field label="PIN code">{s.consignorPincode || customer.pincode}</Field><Field label="GSTIN">{s.consignorGstin || customer.gstNumber}</Field>
            </div></div>
            <div className="lr3-title">Consignee</div>
            <div className="lr3-party"><div className="lr3-party-grid">
              <Field label="Name">{s.receiverName}</Field><Field label="Mobile">{s.receiverMobile}</Field>
              <Field label="Address" wide>{[s.consigneeAddress, s.consigneeAddress2, s.consigneeAddress3].filter(Boolean).join(', ')}</Field>
              <Field label="PIN code">{s.consigneePincode}</Field><Field label="GSTIN">{s.consigneeGstin}</Field>
            </div></div>
            <div className="lr3-instructions"><span>Special instructions / Remarks</span><strong>{show(s.remarks)}</strong></div>
          </div>

          <div className="lr3-column">
            <div className="lr3-title">Reference and document details</div>
            <div className="lr3-reference">
              <Field label="Invoice No. / Date">{`${show(s.invoiceNo)} / ${date(s.invoiceDate)}`}</Field><Field label="E-Way Bill / Date">{`${show(s.eWayBillNo)} / ${date(s.eWayBillDate)}`}</Field>
              <Field label="PO / STN No.">{s.poStnNo}</Field><Field label="Customer reference">{s.customerReference}</Field>
            </div>
            <div className="lr3-goods"><table>
              <thead><tr><th style={{ width: '10%' }}><span>Pkg.</span></th><th style={{ width: '29%' }}><span>Goods</span></th><th style={{ width: '14%' }}><span>Type</span></th><th style={{ width: '8%' }}><span>Qty</span></th><th style={{ width: '11%' }}><span>Act. Wt.</span></th><th style={{ width: '11%' }}><span>Chg. Wt.</span></th><th style={{ width: '17%' }}><span>L x B x H</span></th></tr></thead>
              <tbody>{rows.map((row, index) => <tr key={index}><td>{row ? show(row.packageNumber || index + 1) : ''}</td><td>{row ? show(row.description) : ''}</td><td>{row ? show(row.packageType) : ''}</td><td>{row ? show(row.quantity) : ''}</td><td>{row ? show(row.actualWeight) : ''}</td><td>{row ? show(row.chargedWeight) : ''}</td><td>{row ? show(row.length ? `${row.length}x${row.breadth}x${row.height} ${row.dimensionUnit}` : row.dimensions) : ''}</td></tr>)}</tbody>
            </table></div>
            <div className="lr3-summary">
              <Field label="Total packages">{s.packageCount}</Field><Field label="Declared value">{money(s.declaredValue)}</Field><Field label="Actual / Volumetric">{`${show(s.actualWeight ?? s.weightKg)} / ${show(s.volumetricWeight)} kg`}</Field><Field label="Chargeable weight">{`${show(s.chargedWeight)} kg`}</Field>
            </div>
            <div className="lr3-receiver"><div><span>Delivery address</span><strong>{show(s.deliveryAddress)}</strong><span>Contact</span><strong>{show(s.contactNo || s.receiverMobile)}</strong></div><div><span>Receiver name</span><strong>{show(s.receiverNamePrint || s.receiverName)}</strong><span>Date &amp; time</span><strong>{date(s.receiverDateTime, true)}</strong></div></div>
          </div>

          <div className="lr3-column">
            <div className="lr3-title">Service, payment and charges</div>
            <div className="lr3-service">
              {['PAID', 'TO_PAY', 'CREDIT'].map((item) => <Tick key={item} label={readable(item)} active={s.paymentMode === item} />)}
              {['CARRIER_RISK', 'OWNER_RISK'].map((item) => <Tick key={item} label={readable(item)} active={s.riskType === item} />)}
            </div>
            <div className="lr3-charge-title">Charges</div>
            {charges.map(([label, amount]) => <div className="lr3-charge" key={label}><span>{label}</span><strong>{money(amount)}</strong></div>)}
            <div className="lr3-charge emphasis"><span>SUB TOTAL</span><strong>{money(subtotal)}</strong></div>
            <div className="lr3-charge emphasis"><span>GST ({show(s.gstRate)}%)</span><strong>{money(s.gstAmount)}</strong></div>
            <div className="lr3-charge total"><span>GRAND TOTAL</span><strong>{money(s.totalAmount)}</strong></div>
            <div className="lr3-payment"><span>Insurance</span><div>{['INSURED', 'NOT_INSURED'].map((item) => <Tick key={item} label={readable(item)} active={s.insuranceType === item} />)}</div></div>
            <div className="lr3-pricing">Freight basis: <b>{readable(s.freightBasis) || '-'}</b> | Rate: <b>{money(s.freightRate)}</b><br />Fuel: <b>{show(s.fuelRatePercent)}%</b> | ROV: <b>{show(s.rovRatePercent)}%</b></div>
            <div className="lr3-insurance"><span>Receiver mobile</span><strong>{show(s.receiverMobilePrint || s.receiverMobile)}</strong></div>
          </div>
        </section>

        <footer className="lr3-footer">
          <div><span>Terms and declaration</span><div className="lr3-terms">Goods are accepted subject to the terms and conditions of Chaple Roadlines Pvt. Ltd. Shipment particulars are declared by the consignor.</div></div>
          <div><span>Shipper signature</span><strong>{show(s.shipperSignature)}</strong></div>
          <div><span>Receiver signature / Stamp</span><strong>{show(s.receiverSignature)}</strong></div>
        </footer>
      </div>
    </div>
  );
});

export default LrTemplate3;
