import { useState } from 'react';
import { jsPDF } from 'jspdf';
import { Download, Eye } from 'lucide-react';
import { toast } from 'sonner';

const ink = [28, 38, 52];
const muted = [92, 105, 121];
const accent = [31, 78, 120];
const value = (input) => (input === 0 || input ? String(input) : '-');
const entity = (input) => input?.name || input?.city || input || '-';
const formatDate = (input) => {
  if (!input) return '-';
  const parsed = new Date(input);
  return Number.isNaN(parsed.getTime()) ? value(input) : parsed.toLocaleDateString('en-GB');
};
const money = (input) => input === 0 || input ? `Rs. ${Number(input).toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '-';

export function createLrPdfBlob(shipment = {}) {
  const s = { ...shipment, ...shipment.lrDetails };
  const customer = typeof s.customerId === 'object' ? s.customerId : s.customer || {};
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const left = 16;
  const right = 194;
  let y = 17;

  const line = (at = y) => {
    pdf.setDrawColor(218, 225, 232);
    pdf.line(left, at, right, at);
  };
  const text = (content, x, at, size = 9, color = ink, style = 'normal') => {
    pdf.setFont('helvetica', style);
    pdf.setFontSize(size);
    pdf.setTextColor(...color);
    pdf.text(String(content), x, at);
  };
  const field = (label, content, x, width, at, maxLines = 2) => {
    text(label.toUpperCase(), x, at, 7, muted, 'bold');
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    const lines = pdf.splitTextToSize(value(content), width).slice(0, maxLines);
    lines.forEach((part, index) => text(part, x, at + 5 + index * 4.5));
    return Math.max(10, 5 + lines.length * 4.5);
  };
  const section = (title) => {
    y += 2;
    pdf.setFillColor(238, 243, 248);
    pdf.rect(left, y, right - left, 8, 'F');
    text(title.toUpperCase(), left + 3, y + 6, 8, accent, 'bold');
    y += 12;
  };
  const row = (items) => {
    const width = (right - left) / items.length;
    const height = Math.max(...items.map(([label, content], index) => field(label, content, left + index * width, width - 5, y)));
    y += height + 2;
  };

  text('LORRY RECEIPT', left, y, 18, ink, 'bold');
  text('CONSIGNMENT NOTE', 145, y, 8, accent, 'bold');
  y += 9;
  text(value(s.lrNumber), left, y, 13, accent, 'bold');
  y += 5;
  line();
  y += 7;
  row([['Booking date', formatDate(s.bookingDate || s.createdAt)], ['Booking branch', s.bookingBranch || entity(s.originBranchId)], ['Status', s.currentStatus || 'BOOKED']]);
  row([['From', s.from || entity(s.originBranchId)], ['To', s.to || entity(s.destinationBranchId)]]);

  section('Consignor and consignee');
  row([['Consignor', s.consignorName || s.senderName || customer.name], ['Consignee', s.consigneeName || s.receiverName]]);
  row([['Consignor address', s.consignorAddress || customer.address], ['Consignee address', s.consigneeAddress]]);
  row([['Consignor GSTIN', s.consignorGstin || customer.gstNumber], ['Consignee GSTIN', s.consigneeGstin]]);
  row([['Contact', s.contactNo || s.receiverMobile], ['Delivery address', s.deliveryAddress]]);

  section('Goods and documents');
  row([['Description', s.goodsDescription || s.description], ['Packages', s.packageNumber || s.packageCount], ['Package type', s.packageType]]);
  row([['Actual weight', s.actualWeight || s.weightKg ? `${s.actualWeight || s.weightKg} kg` : null], ['Charged weight', s.chargedWeight ? `${s.chargedWeight} kg` : null], ['Declared value', money(s.declaredValue)]]);
  row([['Invoice no.', s.invoiceNo], ['E-way bill no.', s.eWayBillNo], ['Customer reference', s.customerReference]]);

  section('Payment');
  row([['Payment mode', s.paymentMode?.replaceAll('_', ' ')], ['Risk', s.riskType?.replaceAll('_', ' ')], ['Total amount', money(s.totalAmount)]]);
  row([['Freight', money(s.freightCharges)], ['GST', money(s.gstAmount)], ['Other charges', money([s.fuelCharges, s.handlingCharges, s.fodCodCharges, s.rovCharges, s.docketCharges].reduce((sum, item) => sum + (Number(item) || 0), 0))]]);

  section('Remarks');
  y += field('Special instructions', s.remarks, left, right - left, y, 3);

  if (y > 258) pdf.addPage();

  line(264);
  text('Consignor signature', left, 273, 8, muted);
  text('Receiver signature', 86, 273, 8, muted);
  text('Authorized signature', 156, 273, 8, muted);
  text('Computer-generated LR • Verify details before dispatch', left, 286, 7, muted);
  return pdf.output('blob');
}

const fileName = (number) => `${String(number || 'LR').replace(/[^a-z0-9-_]/gi, '_')}.pdf`;

export function LrPdfDownload({ shipment, className = 'btn secondary' }) {
  const [busy, setBusy] = useState(false);
  const run = async (view) => {
    const popup = view ? window.open('', '_blank') : null;
    if (popup) popup.opener = null;
    setBusy(true);
    try {
      if (view && !popup) throw new Error('Popup blocked. Please allow popups and try again.');
      const url = URL.createObjectURL(createLrPdfBlob(shipment));
      if (view) {
        popup.location.href = url;
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      } else {
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName(shipment?.lrNumber);
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        toast.success('LR PDF downloaded');
      }
    } catch (error) {
      popup?.close();
      toast.error(error instanceof Error ? error.message : 'Unable to create LR PDF.');
    } finally {
      setBusy(false);
    }
  };
  return <>
    <button type="button" className="btn secondary" disabled={busy} onClick={() => run(true)}><Eye size={16} /> {busy ? 'Preparing...' : 'View LR'}</button>
    <button type="button" className={className} disabled={busy} onClick={() => run(false)}><Download size={16} /> {busy ? 'Preparing...' : 'Download LR PDF'}</button>
  </>;
}
