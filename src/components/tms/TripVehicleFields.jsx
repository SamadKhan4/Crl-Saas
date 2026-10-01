import { useState } from 'react';
import { idOf } from '../../lib/workflow';

const detailsFor = (vehicle) => ({
  vehicleNumber: vehicle?.vehicleNumber || '', vehicleType: vehicle?.vehicleType || '',
  vehicleCapacityKg: vehicle?.capacityKg ?? '', driverName: vehicle?.driverName || '', driverMobile: vehicle?.driverMobile || '',
});

export default function TripVehicleFields({ vendors, source, vendorId, onSourceChange, onVendorChange }) {
  const [details, setDetails] = useState(() => detailsFor(vendors.find((row) => idOf(row) === vendorId)?.vehicles?.find((row) => row.status !== 'INACTIVE')));
  const vendor = vendors.find((row) => idOf(row) === vendorId);
  const vehicles = (vendor?.vehicles || []).filter((row) => row.status !== 'INACTIVE');
  const field = (name, value) => setDetails((current) => ({ ...current, [name]: value }));
  return <>
    <label>Vehicle Source<select value={source} onChange={(event) => { onSourceChange(event.target.value); setDetails(detailsFor(vehicles[0])); }}><option value="VV">VV - Vendor Vehicle</option><option value="MV">MV - Market Vehicle</option></select></label>
    <label>Vendor<select name="vendorId" value={vendorId} required={source === 'VV'} onChange={(event) => {
      const selected = vendors.find((row) => idOf(row) === event.target.value);
      onVendorChange(event.target.value);
      setDetails(detailsFor(selected?.vehicles?.find((row) => row.status !== 'INACTIVE')));
    }}><option value="">{source === 'VV' ? 'Select vendor' : 'Optional transporter'}</option>{vendors.map((row) => <option key={idOf(row)} value={idOf(row)}>{row.vendorCode} - {row.name}</option>)}</select></label>
    {vehicles.length > 0 && <label>Mapped vehicle<select aria-label="Mapped vehicle" value={vehicles.some((row) => row.vehicleNumber === details.vehicleNumber) ? details.vehicleNumber : ''} onChange={(event) => setDetails(detailsFor(vehicles.find((row) => row.vehicleNumber === event.target.value)))}><option value="">Select mapped vehicle</option>{vehicles.map((row) => <option key={row.vehicleNumber} value={row.vehicleNumber}>{row.vehicleNumber} - {row.vehicleType || 'Vehicle'}</option>)}</select></label>}
    <label>Vehicle Number<input name="vehicleNumber" required readOnly={source === 'VV' && vehicles.length > 0} value={details.vehicleNumber} onChange={(event) => { field('vehicleNumber', event.target.value); if (source === 'MV') setDetails({ ...detailsFor(), vehicleNumber: event.target.value }); }} /></label>
    <label>Vehicle Type<input name="vehicleType" value={details.vehicleType} onChange={(event) => field('vehicleType', event.target.value)} /></label>
    <label>Capacity (kg)<input name="vehicleCapacityKg" type="number" min="1" value={details.vehicleCapacityKg} onChange={(event) => field('vehicleCapacityKg', event.target.value)} /></label>
    <label>Driver Name<input name="driverName" required={source === 'MV'} value={details.driverName} onChange={(event) => field('driverName', event.target.value)} /></label>
    <label>Driver Mobile<input name="driverMobile" value={details.driverMobile} onChange={(event) => field('driverMobile', event.target.value)} /></label>
  </>;
}
