import { serviceLocations } from '../../data/serviceLocations';

export default function CreditDestinationSelect({ rates = [], value, onChange, error }) {
  const rateByLocation = new Map(rates.map((rate) => [rate.location, rate]));
  const availableCount = serviceLocations.filter((row) => rateByLocation.has(row.location)).length;
  const groups = [
    ['NEXT_DAY', 'Next-day delivery'],
    ['LONG_DISTANCE', 'Long-distance delivery'],
  ];
  return (
    <div className="field">
      <label htmlFor="credit-destination">To — contracted location</label>
      <select
        id="credit-destination"
        value={value?.name || ''}
        aria-invalid={Boolean(error)}
        onChange={(event) => {
          const service = serviceLocations.find((row) => row.location === event.target.value);
          const rate = service && rateByLocation.get(service.location);
          onChange(
            service && rate
              ? {
                  id: `credit-${service.location.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
                  name: service.location,
                  district: service.location,
                  transitDays: service.transitDays,
                  ratePerKg: Number(rate.ratePerKg),
                }
              : null,
          );
        }}
      >
        <option value="">Select customer rate location</option>
        {groups.map(([serviceLevel, title]) => {
          const rows = serviceLocations.filter((row) => row.serviceLevel === serviceLevel);
          return rows.length ? (
            <optgroup label={title} key={serviceLevel}>
              {rows.map((row) => {
                const rate = rateByLocation.get(row.location);
                return (
                  <option value={row.location} key={row.location} disabled={!rate}>
                    {row.location} · {row.transitDays} {row.transitDays === 1 ? 'day' : 'days'} · {rate ? `₹${Number(rate.ratePerKg).toLocaleString('en-IN')}/kg` : 'Rate not configured'}
                  </option>
                );
              })}
            </optgroup>
          ) : null;
        })}
      </select>
      {value && (
        <small className="customer-selected">
          Applied: ₹{Number(value.ratePerKg).toLocaleString('en-IN')}/kg · {value.transitDays} {value.transitDays === 1 ? 'day' : 'days'} transit
        </small>
      )}
      {!availableCount && <small className="field-error">Configure this customer's location rates in Customer Master.</small>}
      {availableCount > 0 && error && <small className="field-error" role="alert">{error}</small>}
    </div>
  );
}
