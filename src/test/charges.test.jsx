import { expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import ChargeTotals from '../components/forms/ChargeTotals';
import { calculateCharges } from '../lib/charges';
import { customerSchema } from '../schemas';

it('requires location-wise per-kg rates for credit customers', () => {
  const customer = {
    customerType: 'CREDIT',
    name: 'Credit Customer',
    mobile: '+919876543210',
    creditRateCard: [{ location: 'Gondia', transitDays: 1, ratePerKg: 28 }],
    creditCharges: { fuelRatePercent: 10, handlingCharges: 50, gstRate: 18 },
  };
  expect(customerSchema.safeParse(customer).success).toBe(true);
  expect(customerSchema.safeParse({ ...customer, creditRateCard: [] }).success).toBe(false);
  expect(customerSchema.parse(customer).creditCharges).toMatchObject({ fuelRatePercent: 10, handlingCharges: 50, gstRate: 18 });
  expect(customerSchema.parse({ ...customer, creditCharges: { freightRate: 10 } }).creditCharges).not.toHaveProperty('freightRate');
});

it('handles blank charges, decimals, zero GST and legacy FOD/COD', () => {
  expect(calculateCharges()).toMatchObject({ gstAmount: 0, totalAmount: 0 });
  expect(calculateCharges({ freightCharges: 99.99, gstRate: 18 })).toMatchObject({ gstAmount: 18, totalAmount: 117.99 });
  expect(calculateCharges({ freightCharges: 100, gstRate: 0 })).toMatchObject({ gstAmount: 0, totalAmount: 100 });
  expect(calculateCharges({ fodCodCharges: 50, fodCharges: 0, codCharges: 20 })).toMatchObject({ gstAmount: 0, totalAmount: 20 });
  expect(calculateCharges({ fodCodCharges: 50 })).toMatchObject({ gstAmount: 0, totalAmount: 50 });
});

it('calculates per-LR freight, fuel, ROV and GST from entered rates', () => {
  expect(calculateCharges({ freightBasis: 'PER_KG', freightRate: 20, chargedWeight: 10 })).toMatchObject({ freightCharges: 200, totalAmount: 200 });
  expect(calculateCharges({ freightBasis: 'PER_BOX', freightRate: 100, packageCount: 4 })).toMatchObject({ freightCharges: 400, totalAmount: 400 });
  expect(calculateCharges({ freightBasis: 'FIXED', freightRate: 1000, fuelRatePercent: 10, handlingCharges: 50, declaredValue: 5000, rovRatePercent: 1, gstRate: 18 })).toEqual({
    freightCharges: 1000, fuelCharges: 100, rovCharges: 50, gstAmount: 216, totalAmount: 1416,
  });
});

it('updates read-only amounts when LR rates or the form reset change', async () => {
  function Form() {
    const { register, control, reset } = useForm({ defaultValues: { freightBasis: 'FIXED', freightRate: '', fuelRatePercent: '', gstRate: '', goods: [] } });
    return <><input aria-label="Freight rate" {...register('freightRate')} /><input aria-label="Fuel rate" {...register('fuelRatePercent')} /><input aria-label="GST rate" {...register('gstRate')} />
      <ChargeTotals control={control} /><button onClick={() => reset()}>Reset</button></>;
  }
  const user = userEvent.setup();
  render(<Form />);
  await user.type(screen.getByLabelText('Freight rate'), '1000');
  await user.type(screen.getByLabelText('Fuel rate'), '10');
  await user.type(screen.getByLabelText('GST rate'), '18');
  expect(screen.getByLabelText('Freight amount')).toHaveValue('1000.00');
  expect(screen.getByLabelText('Fuel amount')).toHaveValue('100.00');
  expect(screen.getByLabelText('GST amount')).toHaveValue('198.00');
  expect(screen.getByLabelText('Total amount')).toHaveValue('1298.00');
  expect(screen.getByLabelText('GST amount')).toHaveAttribute('readonly');
  expect(screen.getByLabelText('Total amount')).toHaveAttribute('readonly');
  await user.clear(screen.getByLabelText('GST rate'));
  expect(screen.getByLabelText('Total amount')).toHaveValue('1100.00');
  await user.click(screen.getByRole('button', { name: 'Reset' }));
  expect(screen.getByLabelText('Total amount')).toHaveValue('0.00');
});
