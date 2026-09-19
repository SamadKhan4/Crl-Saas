import { FormField } from '../common/UI';

const fields = [
  ['fuelRatePercent', 'Fuel charge (% of freight)', 100],
  ['handlingCharges', 'Handling charges'],
  ['fodCharges', 'FOD charges'],
  ['codCharges', 'COD charges'],
  ['rovRatePercent', 'ROV (% of declared value)', 100],
  ['docketCharges', 'Docket charges'],
  ['gstRate', 'GST rate (%)', 100],
];

export default function CreditChargesFields({ register, errors = {} }) {
  return (
    <section className="credit-customer-charges tms-span-2">
      <div className="credit-rate-toolbar">
        <div>
          <strong>Additional contracted charges</strong>
          <small>These charges will be locked and applied automatically on every credit LR.</small>
        </div>
      </div>
      <div className="form-grid">
        {fields.map(([name, label, max]) => (
          <FormField
            key={name}
            label={label}
            type="number"
            min="0"
            max={max}
            step="any"
            {...register(`creditCharges.${name}`)}
            error={errors[name]?.message}
          />
        ))}
      </div>
    </section>
  );
}
