import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { masterOptionsApi } from '../../api/services';

export default function DeliveryRouteField({ initialValue = '' }) {
  const [manual, setManual] = useState(false);
  const [route, setRoute] = useState(initialValue);
  useEffect(() => { setRoute(initialValue); }, [initialValue]);
  const query = useQuery({ queryKey: ['master-options', 'ROUTE'], queryFn: () => masterOptionsApi.list('ROUTE') });
  return <div className="field">
    <label htmlFor="delivery-route">Route</label>
    {manual ? <input id="delivery-route" name="route" required maxLength={250} value={route} onChange={(event) => setRoute(event.target.value)} placeholder="Enter delivery route" /> :
      <select id="delivery-route" name="route" required value={route} onChange={(event) => setRoute(event.target.value)}>
        <option value="">{query.isPending ? 'Loading routes…' : 'Select route'}</option>
        {(query.data?.data || []).map((item) => <option key={item.id || item._id} value={item.name}>{item.code} - {item.name}{item.origin && item.destination ? ` (${item.origin} → ${item.destination})` : ''}</option>)}
      </select>}
    <button type="button" className="text-btn" onClick={() => { setManual((current) => !current); setRoute(''); }}>{manual ? 'Select saved route' : 'Enter route manually'}</button>
    {!manual && query.isError && <small className="field-error">Could not load routes. You can enter the route manually.</small>}
    {!manual && query.isSuccess && !query.data?.data?.length && <small>No saved routes. Enter the route manually.</small>}
  </div>;
}
