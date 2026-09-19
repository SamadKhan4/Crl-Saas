import { useMemo, useState } from 'react';
import { Controller } from 'react-hook-form';
import { Search } from 'lucide-react';
import { serviceLocations } from '../../data/serviceLocations';

const groups = [
  ['NEXT_DAY', 'Next-day delivery'],
  ['LONG_DISTANCE', 'Long-distance delivery'],
];

function RateCardEditor({ value = [], onChange, error }) {
  const [search, setSearch] = useState('');
  const [bulkRate, setBulkRate] = useState('');
  const selected = useMemo(() => new Map(value.map((row) => [row.location, row])), [value]);
  const query = search.trim().toLowerCase();
  const filtered = serviceLocations.filter(({ location }) => location.toLowerCase().includes(query));
  const validationMessage =
    error?.message ||
    (Array.isArray(error) && error.find(Boolean)?.ratePerKg?.message) ||
    (Array.isArray(error) && error.find(Boolean)?.location?.message);

  const setLocation = (location, checked) => {
    const locationDetails = serviceLocations.find((row) => row.location === location);
    if (!checked) {
      onChange(value.filter((row) => row.location !== location));
      return;
    }
    onChange([
      ...value,
      {
        location,
        transitDays: locationDetails.transitDays,
        ratePerKg: bulkRate || '',
      },
    ]);
  };

  const setRate = (location, ratePerKg) =>
    onChange(value.map((row) => (row.location === location ? { ...row, ratePerKg } : row)));

  const toggleGroup = (serviceLevel) => {
    const rows = filtered.filter((row) => row.serviceLevel === serviceLevel);
    const allSelected = rows.length > 0 && rows.every((row) => selected.has(row.location));
    if (allSelected) {
      const names = new Set(rows.map((row) => row.location));
      onChange(value.filter((row) => !names.has(row.location)));
      return;
    }
    const additions = rows
      .filter((row) => !selected.has(row.location))
      .map((row) => ({ location: row.location, transitDays: row.transitDays, ratePerKg: bulkRate || '' }));
    onChange([...value, ...additions]);
  };

  const applyBulkRate = () => {
    if (!bulkRate || Number(bulkRate) <= 0) return;
    onChange(value.map((row) => ({ ...row, ratePerKg: bulkRate })));
  };

  return (
    <div className="credit-rate-card tms-span-2">
      <div className="credit-rate-toolbar">
        <div>
          <strong>Location-wise freight rate</strong>
          <small>Select multiple locations and enter the agreed freight rate per chargeable kg.</small>
        </div>
        <span>{value.length} selected</span>
      </div>
      <div className="credit-rate-actions">
        <label className="customer-search-input">
          <Search size={16} aria-hidden="true" />
          <input
            value={search}
            maxLength={80}
            placeholder="Search location"
            aria-label="Search service locations"
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <label className="field compact-field">
          <span>Common rate (₹/kg)</span>
          <input
            type="number"
            min="0.01"
            max="1000000"
            step="0.01"
            value={bulkRate}
            onChange={(event) => setBulkRate(event.target.value)}
          />
        </label>
        <button type="button" className="btn secondary" disabled={!value.length || Number(bulkRate) <= 0} onClick={applyBulkRate}>
          Apply to selected
        </button>
      </div>
      {groups.map(([serviceLevel, title]) => {
        const rows = filtered.filter((row) => row.serviceLevel === serviceLevel);
        if (!rows.length) return null;
        const allSelected = rows.every((row) => selected.has(row.location));
        return (
          <section className="credit-rate-group" key={serviceLevel}>
            <div className="credit-rate-group-title">
              <div>
                <strong>{title}</strong>
                <small>{serviceLevel === 'NEXT_DAY' ? '1 transit day' : '2–4 transit days'}</small>
              </div>
              <button type="button" className="text-btn" onClick={() => toggleGroup(serviceLevel)}>
                {allSelected ? 'Clear group' : 'Select group'}
              </button>
            </div>
            <div className="credit-rate-list">
              {rows.map((row) => {
                const rate = selected.get(row.location);
                return (
                  <div className={`credit-rate-row ${rate ? 'selected' : ''}`} key={row.location}>
                    <label>
                      <input
                        type="checkbox"
                        checked={Boolean(rate)}
                        onChange={(event) => setLocation(row.location, event.target.checked)}
                      />
                      <span>
                        <strong>{row.location}</strong>
                        <small>{row.transitDays} {row.transitDays === 1 ? 'day' : 'days'}</small>
                      </span>
                    </label>
                    {rate && (
                      <label className="rate-input">
                        <span>₹/kg</span>
                        <input
                          type="number"
                          min="0.01"
                          max="1000000"
                          step="0.01"
                          value={rate.ratePerKg}
                          aria-label={`${row.location} freight rate per kg`}
                          onChange={(event) => setRate(row.location, event.target.value)}
                        />
                      </label>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
      {!filtered.length && <small>No matching service location.</small>}
      {error && (
        <small className="field-error" role="alert">
          {validationMessage || 'Enter a valid freight rate for every selected location.'}
        </small>
      )}
    </div>
  );
}

export default function CreditRateCardField({ control, error }) {
  return (
    <Controller
      control={control}
      name="creditRateCard"
      defaultValue={[]}
      render={({ field }) => <RateCardEditor value={field.value || []} onChange={field.onChange} error={error} />}
    />
  );
}
