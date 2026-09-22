import { label } from '../../lib/workflow';

const printableDate = (value, withTime = false) => {
  if (!value || Number.isNaN(new Date(value).getTime())) return '—';
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    ...(withTime && { hour: '2-digit', minute: '2-digit' }),
  });
};
const amount = (value) => Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const serviceLabel = (value) => value === 'PACKERS_MOVERS' ? 'Packers & Movers' : value || '—';
const rateBasisLabel = (value) => ({ PER_TRIP: 'Per Trip', PER_KG: 'Per Kg', PER_JOB: 'Per Job' }[value] || '—');
const amountInWords = (value) => {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const words = (number) => number < 20 ? ones[number] : number < 100 ? `${tens[Math.floor(number / 10)]} ${ones[number % 10]}`.trim() : number < 1000 ? `${ones[Math.floor(number / 100)]} Hundred ${words(number % 100)}`.trim() : number < 100000 ? `${words(Math.floor(number / 1000))} Thousand ${words(number % 1000)}`.trim() : number < 10000000 ? `${words(Math.floor(number / 100000))} Lakh ${words(number % 100000)}`.trim() : `${words(Math.floor(number / 10000000))} Crore ${words(number % 10000000)}`.trim();
  const total = Math.max(0, Number(value) || 0), rupees = Math.floor(total), paise = Math.round((total - rupees) * 100);
  return `Rupees ${words(rupees) || 'Zero'}${paise ? ` and ${words(paise)} Paise` : ''} Only`;
};

function Barcode({ value }) {
  return <div className="manifest-barcode" aria-label={`Barcode ${value}`}><span /><b>{value}</b></div>;
}

export function DeliveryManifestSheet({ record, kind = 'drs' }) {
  const shipments = record.shipmentIds || [];
  const number = kind === 'manifest' ? record.manifestNumber : record.drsNumber;
  const branch = record.branchId || {};
  const totalPackages = shipments.reduce((sum, row) => sum + Number(row.packageCount || 0), 0);
  const totalWeight = shipments.reduce((sum, row) => sum + Number(row.weightKg || 0), 0);
  const status = kind === 'manifest' ? record.coLoaderStatus : record.status;
  const vehicle = record.vehicleNumber || '—';
  const deliveryAgent = record.deliveryAgent || record.driverName || record.vendorId?.name || '—';
  return (
    <div className="transport-print-document delivery-manifest-sheet">
      <header className="manifest-title"><strong>DELIVERY MANIFEST</strong><span><b>Date :</b> {printableDate(record.createdAt, true)}</span></header>
      <div className="manifest-meta">
        <div className="manifest-meta-grid">
          <b>Manifest :</b><span>{number}{record.destination ? ` : ${record.destination}` : ''}</span>
          <b>Status :</b><span>{label(status)}</span>
          <b>Manifest Date :</b><span>{printableDate(record.deliveryDate || record.createdAt)}</span>
          <b>Origin :</b><span>{[branch.branchCode, branch.name, branch.city].filter(Boolean).join(', ') || '—'}</span>
          <b>Vehicle# :</b><span>{vehicle}</span>
        </div>
        <Barcode value={number} />
      </div>
      <div className="manifest-totals">
        <span><b>Total# of Consignments :</b> {shipments.length}</span>
        <span><b>Total Packages:</b> {totalPackages}</span>
        <span><b>Total weight:</b> {(totalWeight / 1000).toFixed(3)} Tonnes</span>
        <span><b>BA :</b> {deliveryAgent}</span>
      </div>
      <table className="manifest-table">
        <thead><tr><th>LR#</th><th>Consignor</th><th>Consignee</th><th>Consignee Contact</th><th>Weight<br />(kgs)</th><th>#<br />Pkgs</th><th>COD<br />Amount</th><th>Delivery date /<br />Time</th><th>Signature</th></tr></thead>
        <tbody>
          {shipments.map((shipment) => {
            const details = shipment.lrDetails || {};
            const consignee = [shipment.receiverName, details.consigneeAddress, details.consigneeAddress2, details.to, details.consigneePincode].filter(Boolean).join(', ');
            return <tr key={shipment.id || shipment._id || shipment.lrNumber}>
              <td>{shipment.lrNumber}</td>
              <td>{shipment.senderName}</td>
              <td>{consignee}</td>
              <td>{shipment.receiverMobile || details.receiverMobilePrint || '—'}</td>
              <td className="number-cell">{amount(shipment.weightKg)}</td>
              <td className="number-cell">{shipment.packageCount || 0}</td>
              <td className="number-cell">{amount(details.codCharges)}</td>
              <td />
              <td />
            </tr>;
          })}
        </tbody>
      </table>
      {record.remarks && <p className="manifest-remarks"><b>Remarks:</b> {record.remarks}</p>}
      <footer>Page 1 of 1</footer>
    </div>
  );
}

function InvoiceHeader() {
  return <header className="invoice-brand"><img src="/crl-logo.png" alt="CRL" /><div><h2>CHAPLE ROADLINES PVT. LTD.</h2><b>Goods Transport & Logistics Services</b><span>Shop No. 3, Opp. Joshi Clinic, Beside Pushpa Mobile,<br />Khargaon Road, Wadi, Nagpur-440023 (MH)<br />91-74993 58403 | info@crl-transport.com | www.crl-transport.com</span></div><strong>TAX INVOICE</strong></header>;
}

export function InvoiceSheet({ invoice }) {
  const billTo = invoice.billTo?.name ? invoice.billTo : (invoice.customerId || {});
  const branch = invoice.branchId || {};
  const sourceItems = invoice.lineItems?.length ? invoice.lineItems : (invoice.shipmentIds || []).map((shipment) => {
    const details = shipment.lrDetails || {};
    return {
      shipmentId: shipment.id || shipment._id,
      lrNumber: shipment.lrNumber,
      bookingDate: details.bookingDate || shipment.createdAt,
      origin: details.from,
      destination: details.to,
      packageCount: shipment.packageCount,
      weightKg: shipment.weightKg,
      taxableAmount: Math.max(0, Number(details.totalAmount || 0) - Number(details.gstAmount || 0)),
    };
  });
  const chunks = sourceItems.length ? Array.from({ length: Math.ceil(sourceItems.length / 14) }, (_, index) => sourceItems.slice(index * 14, index * 14 + 14)) : [[]];
  const sameState = branch.state && billTo.state && branch.state.trim().toLowerCase() === billTo.state.trim().toLowerCase();
  const halfTax = Number(invoice.gstAmount || 0) / 2;
  return <div className="transport-print-document invoice-document">
    {chunks.map((items, pageIndex) => {
      const finalPage = pageIndex === chunks.length - 1;
      return <section className="invoice-page" key={pageIndex}>
        <InvoiceHeader />
        <div className="invoice-meta">
          <div><b>Invoice No.</b><span>{invoice.invoiceNumber}</span><b>Invoice Date</b><span>{printableDate(invoice.issueDate || invoice.createdAt)}</span><b>Due Date</b><span>{printableDate(invoice.dueDate)}</span></div>
          <div><b>Status</b><span>{label(invoice.status)}</span><b>Billing Period</b><span>{printableDate(invoice.periodFrom)} to {printableDate(invoice.periodTo)}</span><b>Place of Supply</b><span>{billTo.state || branch.state || '—'}</span></div>
        </div>
        <section className="invoice-bill-to"><h3>Bill To</h3><strong>{billTo.companyName || billTo.name || '—'}</strong><span>{[billTo.address, billTo.city, billTo.state, billTo.pincode].filter(Boolean).join(', ') || '—'}</span><span>GSTIN: {billTo.gstNumber || 'Unregistered'} &nbsp; | &nbsp; Mobile: {billTo.mobile || '—'}</span></section>
        <table className="invoice-table"><thead><tr><th>Sr.</th><th>LR Date</th><th>LR Number</th><th>From - To</th><th>Packages</th><th>Weight (kg)</th><th>Taxable Amount (₹)</th></tr></thead><tbody>
          {items.map((item, index) => <tr key={item.shipmentId || item.lrNumber}><td>{pageIndex * 14 + index + 1}</td><td>{printableDate(item.bookingDate)}</td><td>{item.lrNumber}</td><td>{[item.origin, item.destination].filter(Boolean).join(' - ') || '—'}</td><td className="number-cell">{item.packageCount || 0}</td><td className="number-cell">{amount(item.weightKg)}</td><td className="number-cell">{amount(item.taxableAmount)}</td></tr>)}
        </tbody></table>
        {finalPage && <>
          <div className="invoice-closing">
            <div><b>Amount in words</b><p>{amountInWords(invoice.totalAmount)}</p>{invoice.notes && <p><b>Notes:</b> {invoice.notes}</p>}</div>
            <table><tbody><tr><th>Taxable value</th><td>{amount(invoice.subtotal)}</td></tr>{sameState ? <><tr><th>CGST ({Number(invoice.gstRate || 0) / 2}%)</th><td>{amount(halfTax)}</td></tr><tr><th>SGST ({Number(invoice.gstRate || 0) / 2}%)</th><td>{amount(halfTax)}</td></tr></> : <tr><th>IGST ({invoice.gstRate || 0}%)</th><td>{amount(invoice.gstAmount)}</td></tr>}<tr className="invoice-grand-total"><th>Invoice Total</th><td>₹ {amount(invoice.totalAmount)}</td></tr><tr><th>Paid</th><td>{amount(invoice.paidAmount)}</td></tr><tr><th>Balance Due</th><td>{amount(invoice.balanceAmount)}</td></tr></tbody></table>
          </div>
          <div className="invoice-signature"><span>For CHAPLE ROADLINES PVT. LTD.</span><b>Authorized Signatory</b></div>
        </>}
        <footer><span>This is a computer-generated invoice.</span><span>Page {pageIndex + 1} of {chunks.length}</span></footer>
      </section>;
    })}
  </div>;
}

export function MoneyReceiptSheet({ receipt }) {
  const customer = receipt.customerId || {};
  const branch = receipt.branchId || {};
  const shipments = receipt.shipmentIds || [];
  const allocations = receipt.allocations || [];
  return <div className="transport-print-document receipt-document">
    <section className="receipt-page">
      <header className="invoice-brand receipt-brand">
        <img src="/crl-logo.png" alt="CRL" />
        <div><h2>CHAPLE ROADLINES PVT. LTD.</h2><b>Goods Transport & Logistics Services</b><span>Shop No. 3, Opp. Joshi Clinic, Beside Pushpa Mobile,<br />Khargaon Road, Wadi, Nagpur-440023 (MH)<br />91-74993 58403 | info@crl-transport.com</span></div>
        <strong>MONEY RECEIPT</strong>
      </header>
      <div className="receipt-heading">
        <div><b>Receipt No.</b><strong>{receipt.receiptNumber}</strong></div>
        <div><b>Receipt Date</b><strong>{printableDate(receipt.receiptDate)}</strong></div>
        <div><b>Status</b><strong>{label(receipt.status)}</strong></div>
      </div>
      <section className="receipt-party">
        <h3>Received From</h3>
        <strong>{receipt.receivedFrom || customer.companyName || customer.name || 'â€”'}</strong>
        <span>{[customer.address, customer.city, customer.state, customer.pincode].filter(Boolean).join(', ') || 'â€”'}</span>
        <span>{customer.gstNumber ? `GSTIN: ${customer.gstNumber}` : 'GSTIN: â€”'} &nbsp; | &nbsp; {customer.mobile || 'â€”'} &nbsp; | &nbsp; {customer.email || 'â€”'}</span>
      </section>
      <div className="receipt-amount">
        <span>Amount Received</span><strong>â‚¹ {amount(receipt.amount)}</strong><small>{amountInWords(receipt.amount)}</small>
      </div>
      <div className="receipt-payment-grid">
        <div><b>Payment Mode</b><span>{label(receipt.paymentMode)}</span></div>
        <div><b>Transaction / Cheque Reference</b><span>{receipt.transactionReference || 'â€”'}</span></div>
        <div><b>Receiving Branch</b><span>{[branch.branchCode, branch.name, branch.city].filter(Boolean).join(' - ') || 'â€”'}</span></div>
      </div>
      <h3 className="receipt-section-title">LR Details</h3>
      <table className="receipt-table"><thead><tr><th>Sr.</th><th>LR Number</th><th>Route</th><th>Packages</th><th>Weight (kg)</th></tr></thead><tbody>
        {shipments.length ? shipments.map((shipment, index) => <tr key={shipment.id || shipment._id || shipment.lrNumber}><td>{index + 1}</td><td>{shipment.lrNumber}</td><td>{[shipment.lrDetails?.from, shipment.lrDetails?.to].filter(Boolean).join(' - ') || 'â€”'}</td><td className="number-cell">{shipment.packageCount || 0}</td><td className="number-cell">{amount(shipment.weightKg)}</td></tr>) : <tr><td colSpan="5">No LR allocation recorded.</td></tr>}
      </tbody></table>
      <h3 className="receipt-section-title">Invoice Allocation</h3>
      <table className="receipt-table"><thead><tr><th>Sr.</th><th>Invoice Number</th><th>Invoice Status</th><th>Allocated Amount (â‚¹)</th></tr></thead><tbody>
        {allocations.length ? allocations.map((allocation, index) => <tr key={allocation.invoiceId?.id || allocation.invoiceId?._id || index}><td>{index + 1}</td><td>{allocation.invoiceId?.invoiceNumber || 'â€”'}</td><td>{label(allocation.invoiceId?.status)}</td><td className="number-cell">{amount(allocation.amount)}</td></tr>) : <tr><td colSpan="4">No invoice allocation recorded.</td></tr>}
      </tbody></table>
      {receipt.remarks && <p className="receipt-remarks"><b>Remarks:</b> {receipt.remarks}</p>}
      <div className="receipt-signatures"><div><span>Customer / Depositor</span><b>Signature</b></div><div><span>For CHAPLE ROADLINES PVT. LTD.</span><b>Authorized Signatory</b></div></div>
      <footer><span>This is a computer-generated money receipt.</span><span>Original Copy</span></footer>
    </section>
  </div>;
}

const standardCharges = [
  ['docketCharges', 'Docket / LR Charges', 'Rs.25 - Rs.50 per LR', 'As agreed'],
  ['rovOwnerRisk', 'ROV / Owner Risk', '0.10% of declared value (Min. Rs.25)', 'Subject to LR T&C'],
  ['fod', 'FOD - Freight on Delivery', 'Rs._______ / shipment', 'If applicable'],
  ['codHandling', 'COD Handling', 'Rs._______ or ____% of COD', 'If applicable'],
  ['pickupCharges', 'Pickup Charges', 'Free / Rs._______', 'As per service area'],
  ['odaRemoteArea', 'ODA / Remote Area', 'Actual / Rs._______', 'Destination dependent'],
  ['hamali', 'Hamali / Loading / Unloading', 'Actual / Rs._______', 'Where applicable'],
  ['reattemptDelivery', 'Re-attempt Delivery', 'Rs._______ per attempt', 'After first attempt'],
  ['appointmentDelivery', 'Appointment Delivery', 'Rs._______ per shipment', 'If required'],
  ['detention', 'Detention', 'Rs._______ per vehicle/day', 'After free period'],
  ['storage', 'Storage / Godown', 'Rs._______ per kg/day', 'After free period'],
  ['specialHandling', 'Special / Fragile Handling', 'As mutually agreed', 'Prior approval required'],
  ['insurance', 'Insurance', "Consignor's responsibility / Actual", 'As applicable'],
  ['gst', 'GST', 'As applicable', 'Extra'],
];
const terms = [
  'Rates are applicable for standard transportation and normal commercial cargo unless specifically agreed otherwise.',
  'Chargeable weight shall be actual weight or volumetric weight, whichever is higher, wherever applicable.',
  'ROV / Owner Risk shall be charged at 0.10% of the declared invoice value, subject to a minimum of Rs.25 per LR, unless a different rate is mutually agreed.',
  'Owner-risk consignments are accepted subject to the terms and conditions printed on the reverse of the LR / Consignor Copy.',
  'COD, FOD, ODA, special handling and other value-added services will be charged as applicable and as stated in this quotation.',
  'ODA / remote-area charges may vary according to the exact delivery location and will be advised wherever applicable.',
  'Loading, unloading, hamali, detention, storage and other destination-specific expenses shall be charged wherever applicable unless expressly included in the agreed freight.',
  'Transit time is indicative and excludes Sundays, public holidays, force majeure, traffic restrictions, natural events and other circumstances beyond the carrier\'s reasonable control.',
  'GST and other statutory taxes / levies shall be charged extra as applicable.',
  'The quotation is valid for 30 days from the date of issue unless otherwise stated. Rates may be reviewed if there is a significant change in operating costs, tolls or statutory charges.',
  'Payment terms are as mutually agreed. Overdue amounts may be subject to applicable commercial or statutory charges.',
  'Any special commodity, hazardous material, fragile cargo or high-value shipment requires prior written acceptance.',
];

function QuotationHeader() {
  return <header className="quotation-brand"><img src="/crl-logo.png" alt="CRL" /><div><h2>CHAPLE ROADLINES PVT. LTD.</h2><b>Shop No. 3, Opp. Joshi Clinic, Beside Pushpa Mobile,<br />Khargaon Road, Wadi, Nagpur-440023 (MH)</b><span>91-74993 58403 &nbsp; info@crl-transport.com<br />www.crl-transport.com</span></div></header>;
}
function SectionTitle({ children }) { return <h3 className="quotation-section-title">{children}</h3>; }

export function QuotationSheet({ quotation }) {
  const rates = [...(quotation.transportationRates || [])];
  if (!rates.length) rates.push({ origin: quotation.origin, destination: quotation.destination, mode: quotation.serviceType || 'PTL', rateBasis: 'PER_KG', rate: quotation.estimatedFreight });
  while (rates.length < 3) rates.push({});
  const charges = quotation.accessorialCharges || {};
  return <div className="transport-print-document quotation-document">
    <section className="quotation-page">
      <QuotationHeader />
      <h1>RATE QUOTATION</h1>
      <table className="quotation-summary"><tbody>
        <tr><th>Quotation No.</th><td>{quotation.quotationNumber}</td><th>Date</th><td>{printableDate(quotation.createdAt)}</td></tr>
        <tr><th>Customer Name</th><td>{quotation.companyName || quotation.leadName}</td><th>Validity</th><td>{quotation.validityDays || 30} Days</td></tr>
        <tr><th>Billing Address</th><td>{quotation.billingAddress || '—'}</td><th>Payment Terms</th><td>{quotation.paymentTerms || '15 / 30 Days'}</td></tr>
        <tr><th>Service Type</th><td>{serviceLabel(quotation.serviceType) || 'FTL / PTL / Packers & Movers'}</td><th>GST</th><td>{quotation.gstRate ? `${quotation.gstRate}%` : 'As Applicable'}</td></tr>
      </tbody></table>
      <SectionTitle>1. TRANSPORTATION RATE</SectionTitle>
      <table className="quotation-table"><thead><tr><th>Sr.</th><th>Origin</th><th>Destination / Zone</th><th>Mode / Service</th><th>Rate Basis</th><th>Rate (₹)</th></tr></thead><tbody>
        {rates.slice(0, 3).map((row, index) => <tr key={index}><td>{index + 1}</td><td>{row.origin || '—'}</td><td>{row.destination || '—'}</td><td>{serviceLabel(row.mode)}</td><td>{rateBasisLabel(row.rateBasis)}</td><td className="number-cell">{row.rate == null ? '—' : amount(row.rate)}</td></tr>)}
      </tbody></table>
      <SectionTitle>2. VALUE-ADDED / ACCESSORIAL CHARGES</SectionTitle>
      <table className="quotation-table charge-table"><thead><tr><th>Sr.</th><th>Charge / Service</th><th>Suggested Commercial Rate</th><th>Remarks</th></tr></thead><tbody>
        {standardCharges.map(([key, service, fallback, remarks], index) => <tr key={key}><td>{index + 1}</td><td>{service}</td><td>{charges[key] || fallback}</td><td>{remarks}</td></tr>)}
      </tbody></table>
      <footer><span>Chaple Roadlines Pvt. Ltd.</span><span>Page 1</span></footer>
    </section>
    <section className="quotation-page">
      <SectionTitle>3. SERVICE & COMMERCIAL TERMS</SectionTitle>
      <table className="quotation-table terms-table"><thead><tr><th>Sr.</th><th>Terms & Conditions</th></tr></thead><tbody>
        {terms.map((term, index) => <tr key={term}><td>{index + 1}</td><td>{term}</td></tr>)}
      </tbody></table>
      <SectionTitle>4. ACCEPTANCE</SectionTitle>
      <p>We thank you for the opportunity to serve your transportation requirements. The above rates and terms are submitted for your kind consideration and approval. Upon acceptance, the agreed rates will be incorporated into the applicable LR / billing process.</p>
      {quotation.notes && <p><b>Commercial note:</b> {quotation.notes}</p>}
      <div className="quotation-signatures"><div><b>For CHAPLE ROADLINES PVT. LTD.</b><span>Authorized Signatory</span></div><div><b>Accepted by Customer</b><span>Name / Designation</span></div></div>
      <footer><span>Chaple Roadlines Pvt. Ltd.</span><span>Page 2</span></footer>
    </section>
  </div>;
}
