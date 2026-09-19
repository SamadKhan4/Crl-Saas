import { serviceLocations } from '../../data/serviceLocations';

const groups = [
  ['NEXT_DAY', 'Next-day delivery'],
  ['LONG_DISTANCE', 'Long-distance delivery'],
];

const optionValue = (location) =>
  `service-${location.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

const asPlace = (row) => ({
  id: optionValue(row.location),
  name: row.location,
  district: row.location,
  transitDays: row.transitDays,
  serviceLevel: row.serviceLevel,
});

export default function DestinationLookup({ label, value, onChange, error }) {
  return (
    <div className="field">
      <label htmlFor={`${label}-location`}>{label}</label>
      <select
        id={`${label}-location`}
        aria-label={label}
        value={value?.id || ''}
        aria-invalid={Boolean(error)}
        onChange={(event) => {
          const selected = serviceLocations.find(
            (row) => optionValue(row.location) === event.target.value,
          );
          onChange(selected ? asPlace(selected) : null);
        }}
      >
        <option value="">Select CRL service location</option>
        {groups.map(([serviceLevel, title]) => (
          <optgroup label={title} key={serviceLevel}>
            {serviceLocations
              .filter((row) => row.serviceLevel === serviceLevel)
              .map((row) => (
                <option value={optionValue(row.location)} key={row.location}>
                  {row.location} · {row.transitDays} {row.transitDays === 1 ? 'day' : 'days'}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
      {error && <small className="field-error" role="alert">{error}</small>}
    </div>
  );
}
