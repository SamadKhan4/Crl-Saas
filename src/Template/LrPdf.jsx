import { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Download, Eye } from 'lucide-react';
import { toast } from 'sonner';
import LrTemplate3 from './LrTemplate3';

export async function createLrPdfBlob(root) {
  if (!root) throw new Error('LR is not ready. Please try again.');
  const logo = root.querySelector('img');
  if (logo) {
    await logo.decode();
  }
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const pages = root.matches('.lr-print-root') ? [root] : [...root.querySelectorAll('.lr-print-root')];
  if (!pages.length) throw new Error('LR is not ready. Please try again.');
  for (const [index, page] of pages.entries()) {
    if (index) pdf.addPage('a4', 'portrait');
    const pageWidth = pdf.internal.pageSize.getWidth(), pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 6;
    const gap = 6;
    const slotHeight = (pageHeight - margin * 2 - gap) / 2;
    const copyLabel = page.querySelector('.lr3-copy-label');
    const originalLabel = copyLabel?.textContent;
    try {
      for (let copy = 0; copy < 2; copy++) {
        if (copyLabel) copyLabel.textContent = copy === 0 ? 'SENDER COPY' : 'RECEIVER COPY';
        const canvas = await html2canvas(page, { scale: 2, backgroundColor: '#ffffff', width: 1000, windowWidth: 1000, useCORS: true });
        const scale = Math.min((pageWidth - margin * 2) / canvas.width, slotHeight / canvas.height);
        const width = canvas.width * scale, height = canvas.height * scale;
        const top = margin + copy * (slotHeight + gap);
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', (pageWidth - width) / 2, top + (slotHeight - height) / 2, width, height, undefined, 'FAST');
      }
    } finally {
      if (copyLabel) copyLabel.textContent = originalLabel;
    }
    pdf.setDrawColor(170);
    pdf.setLineDashPattern([2, 2], 0);
    pdf.line(margin, pageHeight / 2, pageWidth - margin, pageHeight / 2);
    pdf.setLineDashPattern([], 0);
  }
  return pdf.output('blob');
}

const fileName = (number) => `${String(number || 'LR').replace(/[^a-z0-9-_]/gi, '_')}.pdf`;

export function LrPdfDownload({ shipment, className = 'btn secondary' }) {
  const root = useRef(null);
  const goods = shipment?.lrDetails?.goods;
  const rowsPerPage = 6;
  const pages = goods?.length ? Array.from({ length: Math.ceil(goods.length / rowsPerPage) }, (_, index) => ({ ...shipment, lrDetails: { ...shipment.lrDetails, goods: goods.slice(index * rowsPerPage, (index + 1) * rowsPerPage).map((row, rowIndex) => ({ ...row, serialNumber: index * rowsPerPage + rowIndex + 1, packageNumber: row.packageNumber || String(index * rowsPerPage + rowIndex + 1) })) } })) : [shipment];
  const [busy, setBusy] = useState(false);
  const run = async (view) => {
    const popup = view ? window.open('', '_blank') : null;
    if (popup) popup.opener = null;
    setBusy(true);
    try {
      if (view && !popup) throw new Error('Popup blocked. Please allow popups and try again.');
      const url = URL.createObjectURL(await createLrPdfBlob(root.current));
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
    <div aria-hidden="true" style={{ position: 'fixed', left: '-1200px', top: 0, width: 1000, pointerEvents: 'none' }}>
      <div ref={root}>{pages.map((page, index) => <LrTemplate3 key={index} shipment={page} />)}</div>
    </div>
  </>;
}
