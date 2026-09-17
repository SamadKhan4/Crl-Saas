import { useWatch } from 'react-hook-form';
import { FormField } from '../common/UI';
import { calculateCharges } from '../../lib/charges';
import { calculateGoods } from '../../lib/goods';

export default function ChargeTotals({ control }) {
  const names = ['goods', 'freightBasis', 'freightRate', 'fuelRatePercent', 'handlingCharges', 'fodCharges', 'codCharges', 'rovRatePercent', 'docketCharges', 'gstRate'];
  const values = useWatch({ control, name: names });
  const details = Object.fromEntries(names.map((name, index) => [name, values[index]]));
  const totals = calculateCharges({ ...details, ...calculateGoods(details.goods) });
  return <div className="form-grid" aria-live="polite">
    <FormField name="freightCharges" label="Freight amount" value={totals.freightCharges.toFixed(2)} readOnly />
    <FormField name="fuelCharges" label="Fuel amount" value={totals.fuelCharges.toFixed(2)} readOnly />
    <FormField name="rovCharges" label="ROV amount" value={totals.rovCharges.toFixed(2)} readOnly />
    <FormField name="gstAmount" label="GST amount" value={totals.gstAmount.toFixed(2)} readOnly />
    <FormField name="totalAmount" label="Total amount" value={totals.totalAmount.toFixed(2)} readOnly />
  </div>;
}
