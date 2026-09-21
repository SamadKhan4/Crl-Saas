import { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Download, Eye } from 'lucide-react';
import { toast } from 'sonner';
import LrTemplate from './LrTemplate';
import LrTemplate2 from './LrTemplate2';
import LrTemplate3 from './LrTemplate3';

export async function createLrPdfBlob(root) {
  if (!root) throw new Error('LR is not ready. Please try again.');
  const logo = root.querySelector('img');
  if (logo) {
    await logo.decode();
  }
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'in', format: 'a4', compress: true });
  const pages = root.matches('.lr-print-root') ? [root] : [...root.querySelectorAll('.lr-print-root')];
  if (!pages.length) throw new Error('LR is not ready. Please try again.');
  for (const [index, page] of pages.entries()) {
    if (index) pdf.addPage();
    const canvas = await html2canvas(page, { scale: 2, backgroundColor: '#ffffff', width: 1000, windowWidth: 1000, useCORS: true });
    const pageWidth = pdf.internal.pageSize.getWidth(), pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 0.15;
    const scale = Math.min((pageWidth - margin * 2) / canvas.width, (pageHeight - margin * 2) / canvas.height);
    const width = canvas.width * scale, height = canvas.height * scale;
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', (pageWidth - width) / 2, (pageHeight - height) / 2, width, height, undefined, 'FAST');
  }
  return pdf.output('blob');
}

const fileName = (number, template) => `${String(number || 'LR').replace(/[^a-z0-9-_]/gi, '_')}${template === '1' ? '' : `_template-${template}`}.pdf`;

export function LrPdfDownload({ shipment, className = 'btn secondary' }) {
  const root = useRef(null);
  const [template, setTemplate] = useState('1');
  const goods = shipment?.lrDetails?.goods;
  const rowsPerPage = template === '3' ? 6 : 8;
  const pages = goods?.length ? Array.from({ length: Math.ceil(goods.length / rowsPerPage) }, (_, index) => ({ ...shipment, lrDetails: { ...shipment.lrDetails, goods: goods.slice(index * rowsPerPage, (index + 1) * rowsPerPage).map((row, rowIndex) => ({ ...row, packageNumber: row.packageNumber || String(index * rowsPerPage + rowIndex + 1) })) } })) : [shipment];
  const [busy, setBusy] = useState(false);
  const Template = template === '2' ? LrTemplate2 : template === '3' ? LrTemplate3 : LrTemplate;
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
        link.download = fileName(shipment?.lrNumber, template);
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
    <label className="lr-template-select">
      <span>LR Template</span>
      <select value={template} disabled={busy} onChange={(event) => setTemplate(event.target.value)} aria-label="LR Template">
        <option value="1">Template 1</option>
        <option value="2">Template 2 - System Generated</option>
        <option value="3">Template 3 - CRL Classic</option>
      </select>
    </label>
    <button type="button" className="btn secondary" disabled={busy} onClick={() => run(true)}><Eye size={16} /> {busy ? 'Preparing...' : 'View LR'}</button>
    <button type="button" className={className} disabled={busy} onClick={() => run(false)}><Download size={16} /> {busy ? 'Preparing...' : 'Download LR PDF'}</button>
    <div aria-hidden="true" style={{ position: 'fixed', left: '-1200px', top: 0, width: 1000, pointerEvents: 'none' }}>
      <div ref={root}>{pages.map((page, index) => <Template key={index} shipment={page} />)}</div>
    </div>
  </>;
}
