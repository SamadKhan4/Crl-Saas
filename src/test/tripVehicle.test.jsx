import { useState } from 'react';
import { it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TripVehicleFields from '../components/tms/TripVehicleFields';

it('auto-fills market vendor vehicles and clears stale driver details for manual vehicles', async () => {
  const vendors = [{ _id: 'v1', name: 'Transport', vendorCode: 'V001', vehicles: [
    { vehicleNumber: 'MH31AB1234', vehicleType: 'Truck', capacityKg: 5000, driverName: 'Driver One', driverMobile: '9876543210' },
    { vehicleNumber: 'MH31AB5678', vehicleType: 'Van', capacityKg: 1000, driverName: 'Driver Two', driverMobile: '9876543211' },
  ] }];
  function Form() {
    const [source, setSource] = useState('MV'), [vendorId, setVendorId] = useState('');
    return <form><TripVehicleFields vendors={vendors} source={source} vendorId={vendorId} onSourceChange={setSource} onVendorChange={setVendorId} /></form>;
  }
  render(<Form />);
  await userEvent.selectOptions(screen.getByLabelText('Vendor'), 'v1');
  expect(screen.getByLabelText('Vehicle Number')).toHaveValue('MH31AB1234');
  expect(screen.getByLabelText('Vehicle Type')).toHaveValue('Truck');
  expect(screen.getByLabelText('Capacity (kg)')).toHaveValue(5000);
  expect(screen.getByLabelText('Driver Name')).toHaveValue('Driver One');
  await userEvent.selectOptions(screen.getByLabelText('Mapped vehicle'), 'MH31AB5678');
  expect(screen.getByLabelText('Driver Name')).toHaveValue('Driver Two');
  expect(screen.getByLabelText('Vehicle Type')).toHaveValue('Van');
  await userEvent.clear(screen.getByLabelText('Vehicle Number'));
  expect(screen.getByLabelText('Driver Name')).toHaveValue('');
  await userEvent.selectOptions(screen.getByLabelText('Vendor'), '');
  expect(screen.getByLabelText('Capacity (kg)')).toHaveValue(null);
});
