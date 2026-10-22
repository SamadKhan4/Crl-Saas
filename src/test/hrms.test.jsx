import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AttendancePage from '../pages/AttendancePage';
import HolidayCalendarPage from '../pages/HolidayCalendarPage';
import PayslipsPage from '../pages/PayslipsPage';
import { hrAttendanceApi } from '../api/services';
vi.mock('../components/forms/Lookup', () => ({ default: ({ label, value, onChange }) => <label>{label}<select value={value} onChange={(event) => onChange(event.target.value)}><option value="">Select employee</option><option value="507f1f77bcf86cd799439011">CRLEMP000001 Employee</option></select></label> }));
vi.mock('../api/services', () => ({
  payslipsApi: { list: vi.fn(async () => ({ data: [] })), create: vi.fn(), status: vi.fn() },
  hrAttendanceApi: {
    summary: vi.fn(async () => ({ data: { workingDays: 26, paidDays: 25, unpaidDays: 1, paidLeaveDays: 1, missingDays: 0, calendar: [{ date: '2026-10-01', eligible: true, status: 'PRESENT' }, { date: '2026-10-04', eligible: true, sunday: true, status: '' }] } })),
    save: vi.fn(async () => ({ data: {} })), holidays: vi.fn(async () => ({ data: [] })), saveHoliday: vi.fn(async () => ({ data: {} })), deleteHoliday: vi.fn(),
  },
}));
function show(element) { render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter>{element}</MemoryRouter></QueryClientProvider>); }
describe('HR attendance and holiday flows', () => {
  it('lets HR save manual attendance and identifies Sundays separately', async () => {
    show(<AttendancePage />);
    await userEvent.selectOptions(screen.getByLabelText('Employee'), '507f1f77bcf86cd799439011');
    await userEvent.selectOptions(await screen.findByLabelText('Attendance 2026-10-01'), 'UNPAID_LEAVE');
    await waitFor(() => expect(hrAttendanceApi.save).toHaveBeenCalledWith({ employeeId: '507f1f77bcf86cd799439011', date: '2026-10-01', status: 'UNPAID_LEAVE' }, expect.anything()));
    expect(screen.getByText('Sunday - no deduction')).toBeInTheDocument();
    expect(screen.getByLabelText('Attendance calendar')).toBeInTheDocument();
    expect(screen.getByText('P')).toBeInTheDocument();
  });
  it('maps a holiday from the calendar form', async () => {
    show(<HolidayCalendarPage />);
    await userEvent.type(screen.getByLabelText('Holiday date'), '2026-10-02');
    await userEvent.type(screen.getByLabelText('Holiday name'), 'Company Holiday');
    await userEvent.click(screen.getByRole('button', { name: 'Save holiday' }));
    await waitFor(() => expect(hrAttendanceApi.saveHoliday).toHaveBeenCalledWith({ date: '2026-10-02', name: 'Company Holiday' }, expect.anything()));
  });
  it('previews automatic leave deductions when an employee is selected for payroll', async () => {
    show(<PayslipsPage />);
    await userEvent.click(screen.getByRole('button', { name: 'Create payslip' }));
    await userEvent.selectOptions(screen.getByLabelText('Employee'), '507f1f77bcf86cd799439011');
    await screen.findByText(/26 working days/);
    await userEvent.clear(screen.getByLabelText('Basic salary'));
    await userEvent.type(screen.getByLabelText('Basic salary'), '26000');
    expect(screen.getByLabelText('Paid working days (automatic)')).toHaveValue(25);
    expect(screen.getByText(/Leave \/ joining deduction:/).textContent).toMatch(/1,000.*1,000.*25,000/);
  });
});


it('shows automatic present in green and manual absence in red', async () => {
  hrAttendanceApi.summary.mockResolvedValueOnce({ data: { workingDays: 26, paidDays: 25, unpaidDays: 1, paidLeaveDays: 0, calendar: [
    { date: '2026-10-01', eligible: true, status: 'PRESENT' },
    { date: '2026-10-02', eligible: true, status: 'ABSENT' },
  ] } });
  show(<AttendancePage />);
  await userEvent.selectOptions(screen.getByLabelText('Employee'), '507f1f77bcf86cd799439011');
  expect((await screen.findByText('A')).closest('.hr-attendance-day')).toHaveClass('hr-status-absent');
  expect(screen.getByText('P').closest('.hr-attendance-day')).toHaveClass('hr-status-present');
});
