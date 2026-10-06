import { expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DestinationLookup from '../components/forms/DestinationLookup';
import { destinationFromPincode } from '../data/serviceLocations';

it('maps a consignee PIN destination even when its rate is not configured', () => {
  expect(destinationFromPincode(
    { id: '411001:Pune HO', name: 'Pune HO', district: 'Pune', pincode: '411001' },
    [{ location: 'Gondia', ratePerKg: 28 }],
  )).toMatchObject({ name: 'Pune', pincode: '411001', transitDays: 4, hasConfiguredRate: false });
});

it('keeps destinations selectable when a credit rate is missing', async () => {
  const onChange = vi.fn();
  render(<DestinationLookup label="To" rates={[{ location: 'Gondia', ratePerKg: 28 }]} onChange={onChange} />);
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'To' }), 'service-pune');
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ name: 'Pune', hasConfiguredRate: false }));
});

it('accepts a manually entered city outside the built-in list', async () => {
  const changed = vi.fn();
  render(<DestinationLookup label="To" value={null} onChange={changed} />);
  const user = userEvent.setup();
  await user.click(screen.getByLabelText('Or enter destination manually'));
  await user.paste('Custom Estate');
  expect(changed).toHaveBeenLastCalledWith(expect.objectContaining({ name: 'Custom Estate' }));
});
