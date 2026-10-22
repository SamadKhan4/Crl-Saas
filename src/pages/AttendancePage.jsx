import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { hrAttendanceApi } from '../api/services';
import { errorMessage } from '../api/client';
import Lookup from '../components/forms/Lookup';
import { PageHeader, ErrorState, Loadingcrleleton } from '../components/common/UI';
const currentMonth = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).slice(0, 7);
const statuses = ['PRESENT', 'ABSENT', 'UNPAID_LEAVE', 'PAID_LEAVE', 'HALF_DAY'];
export default function AttendancePage() {
  const [employee, setEmployee] = useState('');
  const [month, setMonth] = useState(currentMonth);
  const cache = useQueryClient();
  const query = useQuery({ queryKey: ['attendance', employee, month], queryFn: () => hrAttendanceApi.summary(employee, month), enabled: Boolean(employee && month) });
  const save = useMutation({ mutationFn: hrAttendanceApi.save, onSuccess: () => { cache.invalidateQueries({ queryKey: ['attendance'] }); toast.success('Attendance saved'); }, onError: (error) => toast.error(errorMessage(error)) });
  const summary = query.data?.data;
  const offset = summary?.calendar?.length ? new Date(`${summary.calendar[0].date}T00:00:00`).getDay() : 0;
  return <>
    <PageHeader title="Employee Attendance" description="Every onboarded employee is included, with or without a login. Working days are present by default; mark only absences or leave." />
    <section className="panel form-section"><div className="form-grid">
      <Lookup resource="users" employeeOnly label="Employee" value={employee} onChange={setEmployee} />
      <label>Attendance month<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label>
    </div></section>
    {employee && (query.isPending ? <Loadingcrleleton /> : query.isError ? <ErrorState error={errorMessage(query.error)} retry={query.refetch} /> : summary && <section className="panel form-section">
      <p>{summary.workingDays} working days | {summary.unpaidDays} unpaid / absent days | {summary.paidLeaveDays} paid leave days</p>
      <p className="hr-attendance-legend"><span className="hr-status-present">P - Present (automatic)</span><span className="hr-status-absent">A - Absent</span><span>PL - Paid leave | UL - Unpaid leave | HD - Half day</span></p>
      <p>Select a day to change attendance. Sundays and holidays have no deduction.</p>
      <div className="hr-holiday-calendar hr-attendance-calendar" aria-label="Attendance calendar">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <b key={day}>{day}</b>)}
        {Array.from({ length: offset }, (_, index) => <span key={`blank-${index}`} />)}
        {summary.calendar.map((day) => {
          const off = day.sunday || Boolean(day.holiday);
          const status = day.status || (!off && day.eligible ? 'PRESENT' : '');
          const absent = ['ABSENT', 'UNPAID_LEAVE'].includes(status);
          const code = !day.eligible ? '-' : off ? (day.holiday ? 'H' : 'S') : ({ PRESENT: 'P', ABSENT: 'A', UNPAID_LEAVE: 'UL', PAID_LEAVE: 'PL', HALF_DAY: 'HD' }[status] || 'P');
          return <div key={day.date} className={`hr-attendance-day ${!day.eligible || off ? 'hr-attendance-off' : absent ? 'hr-status-absent' : 'hr-status-present'}`}>
            <span>{Number(day.date.slice(-2))}</span><strong aria-label={`${day.date} ${status || code}`}>{code}</strong>
            {!day.eligible ? <small>Before joining</small> : off ? <small>{day.holiday || 'Sunday'} - no deduction</small> : <select aria-label={`Attendance ${day.date}`} value={status} disabled={save.isPending} onChange={(event) => save.mutate({ employeeId: employee, date: day.date, status: event.target.value })}>
              {statuses.map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}
            </select>}
          </div>;
        })}
      </div>
    </section>)}
  </>;
}
