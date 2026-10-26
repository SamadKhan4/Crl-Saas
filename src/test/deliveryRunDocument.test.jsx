import { expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DeliveryManifestSheet } from '../components/tms/TransportPrintLayouts';

it('prints a DRS with selected LRs without source manifest references', () => {
  render(<DeliveryManifestSheet record={{ drsNumber: 'DRS001', status: 'OPEN', manifestId: { manifestNumber: 'MNF001' }, vendorId: { name: 'Delivery Vendor', vendorCode: 'V001' }, vehicleNumber: 'MH31AB1234', driverName: 'Mapped Driver', shipmentIds: [
    { _id: 'lr1', lrNumber: 'LR001', manifestId: 'manifest1', packageCount: 20, weightKg: 100 },
    { _id: 'lr2', lrNumber: 'LR002', manifestId: 'manifest2', packageCount: 5, weightKg: 50 },
  ] }} />);
  expect(screen.getByText('DELIVERY RUN SHEET')).toBeInTheDocument();
  expect(screen.getByText('DRS number')).toBeInTheDocument();
  expect(screen.getByText('DRS001')).toBeInTheDocument();
  expect(screen.getByText('LR001')).toBeInTheDocument();
  expect(screen.getByText('LR002')).toBeInTheDocument();
  expect(screen.queryByText(/manifest/i)).not.toBeInTheDocument();
  expect(screen.getByRole('columnheader', { name: 'Receiver signature' })).toBeInTheDocument();
  expect(screen.getByText('Mapped Driver')).toBeInTheDocument();
});
