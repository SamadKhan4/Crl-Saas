import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { calculateGoods } from '../lib/goods';
import { goodsSchema, lrCreateSchema } from '../schemas';
import GoodsFields, { emptyGoods } from '../components/forms/GoodsFields';
import LrTemplate from '../Template/LrTemplate';
import { LrPdfDownload } from '../Template/LrPdf';

vi.mock('../Template/LrBarcode', () => ({
  default: ({ value, className }) => <svg aria-label={`Barcode ${value}`} className={className} />,
}));

const row = { description: 'Cartons', quantity: 1, actualWeight: 5, length: 30, breadth: 30, height: 30, dimensionUnit: 'CM' };

describe('LR goods and chargeable weight', () => {
  it.each([['CM', 30], ['IN', 12], ['FT', 1]])('calculates one CFT in %s', (dimensionUnit, size) => {
    expect(calculateGoods([{ ...row, dimensionUnit, length: size, breadth: size, height: size }])).toMatchObject({ volume: 1, volumetricWeight: 7, chargedWeight: 7 });
  });
  it('multiplies volume by quantity and compares shipment totals', () => {
    expect(calculateGoods([{ ...row, quantity: 2 }, { ...row, actualWeight: 20 }])).toMatchObject({ packageCount: 3, actualWeight: 25, volume: 3, volumetricWeight: 21, chargedWeight: 25 });
  });
  it('uses actual weight without dimensions and rejects incomplete or invalid rows', () => {
    const undimensioned = { ...row, length: undefined, breadth: undefined, height: undefined };
    expect(calculateGoods([undimensioned]).chargedWeight).toBe(5);
    expect(goodsSchema.safeParse(undimensioned).success).toBe(true);
    for (const patch of [{ length: -1 }, { height: undefined }, { quantity: 1.5 }, { actualWeight: 0 }, { dimensionUnit: 'M' }, { declaredValue: 100 }])
      expect(goodsSchema.safeParse({ ...row, ...patch }).success).toBe(false);
    expect(lrCreateSchema.safeParse({ lrNumber: '', goods: [row] }).success).toBe(false);
  });
  it('adds and removes form rows and recalculates the displayed weight', async () => {
    function Form() {
      const form = useForm({ defaultValues: { goods: [{ ...emptyGoods(), ...row }] } });
      return <GoodsFields {...form} errors={{}} />;
    }
    const user = userEvent.setup();
    render(<Form />);
    expect(screen.getAllByLabelText('Total declared value (₹)')).toHaveLength(1);
    expect(screen.getAllByText('7 kg', { selector: 'strong' })).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Add goods' }));
    expect(screen.getAllByLabelText('Description of goods')).toHaveLength(2);
    expect(screen.getAllByLabelText('Total declared value (₹)')).toHaveLength(1);
    await user.type(screen.getAllByLabelText('Actual weight for this row (kg)')[1], '20');
    expect(screen.getAllByText('25 kg', { selector: 'strong' })).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Remove goods 2' }));
    expect(screen.getAllByLabelText('Description of goods')).toHaveLength(1);
  });
  it('prints multiple goods, separate FOD/COD and the invoice weight', () => {
    const totals = calculateGoods([row, { ...row, description: 'Machine', actualWeight: 20 }]);
    const { container } = render(<LrTemplate shipment={{ lrNumber: '123', lrDetails: { ...totals, fodCharges: 0, codCharges: 75 } }} />);
    expect(container.querySelectorAll('tbody tr')).toHaveLength(3);
    expect(screen.getByText('Cartons')).toBeInTheDocument();
    expect(screen.getByText('Machine')).toBeInTheDocument();
    expect(screen.getByText('FOD CHARGES')).toBeInTheDocument();
    expect(screen.getByText('COD CHARGES')).toBeInTheDocument();
    expect(screen.getByText(/Chargeable weight for invoice: 25 kg/)).toBeInTheDocument();
  });
  it('keeps every goods row when the PDF needs another page', () => {
    const totals = calculateGoods(Array.from({ length: 9 }, (_, index) => ({ ...row, description: `Goods ${index + 1}` })));
    const { container } = render(<LrPdfDownload shipment={{ lrNumber: '123', lrDetails: totals }} />);
    expect(container.querySelectorAll('.lr-print-root')).toHaveLength(2);
    expect(container.querySelectorAll('tbody tr')).toHaveLength(12);
    expect(screen.getByText('Goods 9')).toBeInTheDocument();
    expect(container.querySelectorAll('.lr-print-root')[1].querySelector('tbody td').textContent).toBe('7');
  });
  it('uses only the final classic template with six goods rows per page', () => {
    const goods = Array.from({ length: 7 }, (_, index) => ({ ...row, description: `Classic goods ${index + 1}` }));
    const { container } = render(<LrPdfDownload shipment={{ lrNumber: '123', lrDetails: { goods } }} />);
    expect(screen.queryByRole('combobox', { name: 'LR Template' })).not.toBeInTheDocument();
    const pages = container.querySelectorAll('.lr3-root');
    expect(pages).toHaveLength(2);
    expect(pages[0]).toHaveStyle({ width: '1000px', height: '670px' });
    expect(pages[0].querySelectorAll('tbody tr')).toHaveLength(6);
  });
});
