import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { get, errorMessage } from '../../api/client';
import { useDebounce } from '../../hooks/useList';

export default function DestinationLookup({ label, value, onChange, error }) {
  const [search, setSearch] = useState('');
  const term = useDebounce(search);
  const query = useQuery({ queryKey: ['destinations', term], queryFn: () => get('/destinations', { search: term }), staleTime: 86400000 });
  const places = query.data?.data || [];
  const options = places.slice(0, 3);
  const selected = value;
  const caption = (place) => `${place.name}, ${place.district} - ${place.pincode}`;
  return <div className="field">
    <label htmlFor={`${label}-search`}>{label}</label>
    <input id={`${label}-search`} aria-label={`Search ${label}`} placeholder="Type area name or complete PIN code" value={search} maxLength={100} onChange={(event) => setSearch(event.target.value)} />
    <select aria-label={label} value={value?.id || ''} disabled={!query.isSuccess} aria-invalid={!!error}
      onChange={(event) => onChange(places.find((place) => place.id === event.target.value))}>
      <option value="">Select area</option>
      {selected && !options.some((place) => place.id === selected.id) && <option value={selected.id}>{caption(selected)}</option>}
      {options.map((place) => <option key={place.id} value={place.id}>{caption(place)}</option>)}
    </select>
    {query.isFetching && <small>Finding Vidarbha areas...</small>}
    {query.isError && <div role="alert"><small className="field-error">{errorMessage(query.error)}</small> <button type="button" className="table-action" onClick={() => query.refetch()}>Retry</button></div>}
    {query.isSuccess && <small aria-live="polite">{places.length ? `${places.length} matching areas` : 'No Vidarbha area found.'}</small>}
    {error && <small className="field-error" role="alert">{error}</small>}
  </div>;
}
