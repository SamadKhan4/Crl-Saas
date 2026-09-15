import { expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import ChargeTotals from '../components/forms/ChargeTotals';
import { calculateCharges } from '../lib/charges';

it('handles blank charges, decimals, zero GST and legacy FOD/COD', () => {
  expect(calculateCharges()).toEqual({ gstAmount: 0, totalAmount: 0 });
  expect(calculateCharges({ freightCharges: 99.99, gstRate: 18 })).toEqual({ gstAmount: 18, totalAmount: 117.99 });
  expect(calculateCharges({ freightCharges: 100, gstRate: 0 })).toEqual({ gstAmount: 0, totalAmount: 100 });
  expect(calculateCharges({ fodCodCharges: 50, fodCharges: 0, codCharges: 20 })).toEqual({ gstAmount: 0, totalAmount: 20 });
  expect(calculateCharges({ fodCodCharges: 50 })).toEqual({ gstAmount: 0, totalAmount: 50 });
});

it('updates read-only totals when charges, GST rate or the form reset change', async () => {
  function Form() {
    const { register, control, reset } = useForm({ defaultValues: { freightCharges: '', gstRate: '' } });
    return <><input aria-label="Freight" {...register('freightCharges')} /><input aria-label="GST rate" {...register('gstRate')} />
      <ChargeTotals control={control} /><button onClick={() => reset()}>Reset</button></>;
  }
  const user = userEvent.setup();
  render(<Form />);
  await user.type(screen.getByLabelText('Freight'), '1000');
  await user.type(screen.getByLabelText('GST rate'), '18');
  expect(screen.getByLabelText('GST amount')).toHaveValue('180.00');
  expect(screen.getByLabelText('Total amount')).toHaveValue('1180.00');
  expect(screen.getByLabelText('GST amount')).toHaveAttribute('readonly');
  expect(screen.getByLabelText('Total amount')).toHaveAttribute('readonly');
  await user.clear(screen.getByLabelText('GST rate'));
  expect(screen.getByLabelText('Total amount')).toHaveValue('1000.00');
  await user.click(screen.getByRole('button', { name: 'Reset' }));
  expect(screen.getByLabelText('Total amount')).toHaveValue('0.00');
});
