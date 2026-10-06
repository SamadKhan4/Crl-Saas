import { serviceLocationNames } from '../data/serviceLocations';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { masterDataApi, masterOptionsApi } from '../api/services';
import { errorMessage } from '../api/client';
import { idOf } from '../lib/workflow';
import { DataTable, ErrorState, Loadingcrleleton, Modal, PageHeader } from '../components/common/UI';

export default function RouteMasterPage() {
  const cache = useQueryClient();
  const [stops, setStops] = useState([]);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const locations = useQuery({ queryKey: ['master-options', 'LOCATION'], queryFn: () => masterOptionsApi.list('LOCATION') });
  const routes = useQuery({ queryKey: ['master-data', 'ROUTE', page], queryFn: () => masterDataApi.list({ type: 'ROUTE', page, limit: 20 }) });
  const updateDistance = useMutation({ mutationFn: ({ id, distanceKm }) => masterDataApi.update(id, { distanceKm }), onSuccess: () => { setEditing(null); cache.invalidateQueries({ queryKey: ['master-data', 'ROUTE'] }); cache.invalidateQueries({ queryKey: ['master-options', 'ROUTE'] }); toast.success('Route distance saved'); }, onError: (error) => toast.error(errorMessage(error)) });
  const save = useMutation({ mutationFn: masterDataApi.create, onSuccess: () => {
    toast.success('Route created');
    cache.invalidateQueries({ queryKey: ['master-data', 'ROUTE'] }); cache.invalidateQueries({ queryKey: ['master-options', 'ROUTE'] });
  }, onError: (error) => toast.error(errorMessage(error)) });
  if (routes.isPending || locations.isPending) return <Loadingcrleleton />;
  if (routes.isError || locations.isError) return <ErrorState error={errorMessage(routes.error || locations.error)} retry={() => { routes.refetch(); locations.refetch(); }} />;
  const cities = [...new Set([...(locations.data?.data || []).map((row) => row.city || row.name), 'Nagpur', ...serviceLocationNames])];
  return <>
    <PageHeader title="Route Master" description="Name the route, select origin and destination locations, and add stops in travel order." />
    <form className="panel form-section" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); save.mutate({ type: 'ROUTE', name: data.get('name'), origin: data.get('origin'), destination: data.get('destination'), intermediateHubs: stops.filter(Boolean), distanceKm: Number(data.get('distanceKm')) }); }}>
      <div className="form-grid"><label>Route name<input name="name" required minLength={2} maxLength={180} /></label>
      {['origin', 'destination'].map((field, index) => <label key={field}>{index ? 'Destination location / city' : 'Origin location / city'}<input name={field} list="route-location-options" required maxLength={150} defaultValue={index ? '' : 'Nagpur'} placeholder="Select or type location" /></label>)}<label>Distance (km)<input name="distanceKm" type="number" required min="0" max="1000000000" step="0.01" placeholder="Enter route distance" /></label></div>
      <datalist id="route-location-options">{cities.map((city) => <option key={city} value={city} />)}</datalist>
      {stops.map((stop, index) => <div className="actions" key={index}><label>Stop {index + 1}<input list="route-location-options" required maxLength={120} value={stop} placeholder="Select or type location" onChange={(event) => setStops((values) => values.map((value, i) => i === index ? event.target.value : value))} /></label><button type="button" className="text-btn" onClick={() => setStops((values) => values.filter((_, i) => i !== index))}>Remove</button></div>)}
      <button type="button" className="btn secondary" disabled={stops.length >= 25} onClick={() => setStops((values) => [...values, ''])}>Add intermediate city</button>
      <div className="form-actions"><span>Enter the total road distance in kilometres, including selected stops.</span><button className="btn" disabled={save.isPending}>{save.isPending ? 'Creating route...' : 'Create Route'}</button></div>
    </form>
    <section className="panel"><DataTable rows={routes.data?.data || []} pagination={routes.data?.pagination} onPage={setPage} columns={[
      { key: 'code', label: 'Route code' }, { key: 'name', label: 'Route name' },
      { key: 'locations', label: 'Locations', render: (row) => [row.origin, ...(row.intermediateHubs || []), row.destination].join(' ? ') },
      { key: 'edit', label: 'Action', render: (row) => <button className="text-btn" onClick={() => setEditing(row)}>Edit distance</button> },
      { key: 'distanceKm', label: 'Distance (km)', render: (row) => row.distanceKm != null ? `${row.distanceKm} km` : 'Not entered' },
    ]} /></section>
    {editing && <Modal title={`Distance - ${editing.name}`} onClose={() => setEditing(null)}><form onSubmit={(event) => { event.preventDefault(); updateDistance.mutate({ id: idOf(editing), distanceKm: Number(new FormData(event.currentTarget).get('distanceKm')) }); }}><label>Distance (km)<input name="distanceKm" type="number" required min="0" max="1000000000" step="0.01" defaultValue={editing.distanceKm ?? ''} /></label><div className="modal-footer"><button className="btn" disabled={updateDistance.isPending}>{updateDistance.isPending ? 'Saving...' : 'Save distance'}</button></div></form></Modal>}
  </>;
}
