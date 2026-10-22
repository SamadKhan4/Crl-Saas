import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { hrAttendanceApi } from '../api/services';
import { errorMessage } from '../api/client';
import { PageHeader, ErrorState, Loadingcrleleton } from '../components/common/UI';
export default function HolidayCalendarPage() {
  const [month, setMonth] = useState(() => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).slice(0, 7));
  const [date, setDate] = useState('');
  const [name, setName] = useState('');
  const cache = useQueryClient();
  const query = useQuery({ queryKey: ['holidays', month], queryFn: () => hrAttendanceApi.holidays(month), enabled: Boolean(month) });
  const refresh = () => { cache.invalidateQueries({ queryKey: ['holidays'] }); cache.invalidateQueries({ queryKey: ['attendance'] }); };
  const save = useMutation({ mutationFn: hrAttendanceApi.saveHoliday, onSuccess: () => { refresh(); setName(''); toast.success('Holiday mapped'); }, onError: (error) => toast.error(errorMessage(error)) });
  const remove = useMutation({ mutationFn: hrAttendanceApi.deleteHoliday, onSuccess: refresh, onError: (error) => toast.error(errorMessage(error)) });
  const holidays = new Map((query.data?.data || []).map((row) => [row.date, row.name]));
  const [year, number] = month.split('-').map(Number);
  const count = new Date(year, number, 0).getDate();
  const offset = new Date(`${month}-01T00:00:00`).getDay();
  return <>
    <PageHeader title="Holiday Calendar" description="Map company holidays. Sundays and these dates are paid days, included in the monthly salary-day count with no leave deduction." />
    <section className="panel form-section"><label>Calendar month<input type="month" value={month} onChange={(event) => { setMonth(event.target.value); setDate(''); }} /></label>
      {query.isPending ? <Loadingcrleleton /> : query.isError ? <ErrorState error={errorMessage(query.error)} retry={query.refetch} /> : month && <div className="hr-holiday-calendar">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <b key={day}>{day}</b>)}
        {Array.from({ length: offset }, (_, index) => <span key={`blank-${index}`} />)}
        {Array.from({ length: count }, (_, index) => { const value = `${month}-${String(index + 1).padStart(2, '0')}`; const sunday = (index + offset) % 7 === 0; return <button type="button" key={value} className={holidays.has(value) || sunday ? 'hr-holiday-day' : ''} aria-pressed={date === value} onClick={() => { setDate(value); setName(holidays.get(value) || ''); }}><strong>{index + 1}</strong><small>{holidays.get(value) || (sunday ? 'Sunday' : '')}</small></button>; })}
      </div>}
      <form className="form-grid" onSubmit={(event) => { event.preventDefault(); save.mutate({ date, name }); }}>
        <label>Holiday date<input type="date" required value={date} onChange={(event) => { setDate(event.target.value); setMonth(event.target.value.slice(0, 7)); }} /></label>
        <label>Holiday name<input required maxLength={150} value={name} onChange={(event) => setName(event.target.value)} /></label>
        <div className="form-actions"><button className="btn" disabled={save.isPending || !date || !name.trim()}>Save holiday</button>{holidays.has(date) && <button type="button" className="btn secondary" disabled={remove.isPending} onClick={() => remove.mutate(date)}>Remove holiday</button>}</div>
      </form>
    </section>
  </>;
}
