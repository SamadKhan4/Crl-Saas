import { useWatch } from 'react-hook-form';
import { FormField } from '../common/UI';
import { calculateCharges, chargeFields } from '../../lib/charges';

export default function ChargeTotals({ control }) {
  const names = [...chargeFields, 'gstRate'];
  const values = useWatch({ control, name: names });
  const totals = calculateCharges(Object.fromEntries(names.map((name, index) => [name, values[index]])));
  return <div className="form-grid" aria-live="polite">
    <FormField name="gstAmount" label="GST amount" value={totals.gstAmount.toFixed(2)} readOnly />
    <FormField name="totalAmount" label="Total amount" value={totals.totalAmount.toFixed(2)} readOnly />
  </div>;
}
