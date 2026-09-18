import { useState } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Download } from 'lucide-react';
import { toast } from 'sonner';

const safeFileName = (value) => `${String(value || 'document').replace(/[^a-z0-9-_]/gi, '_')}.pdf`;

async function createPdf(root) {
  const documentRoot = root?.querySelector('.transport-print-document') || root;
  if (!documentRoot) throw new Error('Document is not ready.');
  const logo = documentRoot.querySelector('img');
  if (logo && !logo.complete) await logo.decode();
  const nestedPages = [...documentRoot.querySelectorAll('.quotation-page, .invoice-page')];
  const pages = nestedPages.length ? nestedPages : [documentRoot];
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  for (const [index, page] of pages.entries()) {
    if (index) pdf.addPage('a4', 'portrait');
    const canvas = await html2canvas(page, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const scale = Math.min(pageWidth / canvas.width, pageHeight / canvas.height);
    const width = canvas.width * scale;
    const height = canvas.height * scale;
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', (pageWidth - width) / 2, 0, width, height, undefined, 'FAST');
  }
  return pdf.output('blob');
}

export default function TransportPdfDownload({ targetRef, documentNumber, label = 'Download PDF' }) {
  const [busy, setBusy] = useState(false);
  async function download() {
    setBusy(true);
    try {
      const url = URL.createObjectURL(await createPdf(targetRef.current));
      const link = document.createElement('a');
      link.href = url;
      link.download = safeFileName(documentNumber);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      toast.success('PDF downloaded');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to create PDF.');
    } finally {
      setBusy(false);
    }
  }
  return <button type="button" className="btn" disabled={busy} onClick={download}><Download size={16} /> {busy ? 'Preparing…' : label}</button>;
}
