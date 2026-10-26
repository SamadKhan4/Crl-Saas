import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ capture: vi.fn(), Pdf: vi.fn() }));
vi.mock('html2canvas', () => ({ default: mocks.capture }));
vi.mock('jspdf', () => ({ jsPDF: mocks.Pdf }));
import { createLrPdfBlob } from '../Template/LrPdf';
let pdf;
beforeEach(() => {
  vi.clearAllMocks();
  pdf = { internal: { pageSize: { getWidth: () => 210, getHeight: () => 297 } }, setFont: vi.fn(), setFontSize: vi.fn(), setTextColor: vi.fn(), text: vi.fn(), addPage: vi.fn(), addImage: vi.fn(), setDrawColor: vi.fn(), setLineDashPattern: vi.fn(), line: vi.fn(), output: vi.fn(() => 'blob') };
  mocks.Pdf.mockImplementation(() => pdf);
  mocks.capture.mockResolvedValue({ width: 1000, height: 670, toDataURL: () => 'image-data' });
});
it('fits two LR copies in the upper and lower halves of portrait A4', async () => {
  const root = document.createElement('div');
  root.className = 'lr-print-root';
  expect(await createLrPdfBlob(root)).toBe('blob');
  expect(mocks.Pdf).toHaveBeenCalledWith(expect.objectContaining({ orientation: 'portrait', format: 'a4', unit: 'mm' }));
  expect(pdf.addImage).toHaveBeenCalledTimes(2);
  expect(pdf.text).not.toHaveBeenCalled();
  for (const [index, call] of pdf.addImage.mock.calls.entries()) {
    const [, , x, y, width, height] = call;
    expect(x).toBeGreaterThanOrEqual(6);
    expect(x + width).toBeLessThanOrEqual(204);
    expect(y).toBeGreaterThanOrEqual(index * 148.5);
    expect(y + height).toBeLessThanOrEqual((index + 1) * 148.5);
  }
  expect(pdf.line).toHaveBeenCalledWith(6, 148.5, 204, 148.5);
});
it('keeps overflow goods pages and puts two copies of each on its sheet', async () => {
  const root = document.createElement('div');
  root.innerHTML = '<div class="lr-print-root"></div><div class="lr-print-root"></div>';
  await createLrPdfBlob(root);
  expect(mocks.capture).toHaveBeenCalledTimes(4);
  expect(pdf.addPage).toHaveBeenCalledTimes(1);
  expect(pdf.addImage).toHaveBeenCalledTimes(4);
});

it('renders sender and receiver labels inside the LR barcode panel', async () => {
  const root = document.createElement('div');
  root.className = 'lr-print-root';
  root.innerHTML = '<span class="lr3-copy-label">RECEIVER COPY</span>';
  const labels = [];
  mocks.capture.mockImplementation(async (page) => {
    labels.push(page.querySelector('.lr3-copy-label').textContent);
    return { width: 1000, height: 670, toDataURL: () => 'image-data' };
  });
  await createLrPdfBlob(root);
  expect(labels).toEqual(['SENDER COPY', 'RECEIVER COPY']);
  expect(root.textContent).toBe('RECEIVER COPY');
  expect(pdf.text).not.toHaveBeenCalled();
});
