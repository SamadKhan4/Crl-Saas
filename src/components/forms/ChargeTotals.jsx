import { Controller, useWatch } from 'react-hook-form';
import { FormField } from '../common/UI';
import { calculateCharges } from '../../lib/charges';
import { calculateGoods } from '../../lib/goods';

export default function ChargeTotals({ control }) {
  const names = ['goods', 'cftFactor', 'freightBasis', 'freightRate', 'fuelRatePercent', 'handlingCharges', 'fodCharges', 'codCharges', 'rovRatePercent', 'docketCharges', 'gstRate'];
  const values = useWatch({ control, name: names });
  const details = Object.fromEntries(names.map((name, index) => [name, values[index]]));
  const totals = calculateCharges({ ...details, ...calculateGoods(details.goods, details.cftFactor ?? 7) });
  return <div className="form-grid" aria-live="polite">
    <FormField name="freightCharges" label="Freight amount" value={totals.freightCharges.toFixed(2)} readOnly />
    <FormField name="fuelCharges" label="Fuel amount" value={totals.fuelCharges.toFixed(2)} readOnly />
    <FormField name="rovCharges" label="ROV amount" value={totals.rovCharges.toFixed(2)} readOnly />
    <div>
      <Controller name="gstPaidBy" control={control} defaultValue="" render={({ field }) => <fieldset style={{ border: 0, padding: 0, margin: '0 0 12px' }}>
        <legend>GST paid by</legend>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}><input style={{ width: 'auto', margin: 0 }} type="checkbox" checked={field.value === 'TRANSPORTER'} onChange={(event) => field.onChange(event.target.checked ? 'TRANSPORTER' : '')} /> Pay by transporter</label>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}><input style={{ width: 'auto', margin: 0 }} type="checkbox" checked={field.value === 'CUSTOMER'} onChange={(event) => field.onChange(event.target.checked ? 'CUSTOMER' : '')} /> Pay by customer</label>
        </div>
      </fieldset>} />
      <FormField name="gstAmount" label="GST amount" value={totals.gstAmount.toFixed(2)} readOnly />
    </div>
    <FormField name="totalAmount" label="Total amount" value={totals.totalAmount.toFixed(2)} readOnly />
  </div>;
}
