import { env } from '../config/env';
import { Attendance } from '../models/Attendance';
import { Holiday } from '../models/Holiday';
import { Leave } from '../models/Leave';
import { Timesheet } from '../models/Timesheet';
import { TimesheetEntry } from '../models/TimesheetEntry';
import type { ActorContext } from '../types/actor';
import { daysInMonth, isFutureDate, isPreviousMonth, isWeekendDate, todayDateString, weekdayIndex } from '../utils/dates';
import { evaluateFillability } from '../utils/fillability';
import { mapAttendance, mapTimesheet } from '../utils/mappers';
import { summarizeEntries } from '../utils/totals';
import { assertCanViewUser } from './access.service';

export async function getMonthCalendar(actor: ActorContext, year: number, month: number, requestedUserId?: string) {
  const userId = requestedUserId ?? actor.id;
  await assertCanViewUser(actor, userId);
  const today = todayDateString(env.COMPANY_TIMEZONE);
  const days = daysInMonth(year, month);
  const start = days[0] ?? `${year}-01-01`;
  const end = days[days.length - 1] ?? start;
  const [holidays, leaves, timesheet, entries, attendance] = await Promise.all([
    Holiday.find({ date: { $gte: start, $lte: end } }).lean(),
    Leave.find({ user: userId, status: 'approved', startDate: { $lte: end }, endDate: { $gte: start } }).lean(),
    Timesheet.findOne({ user: userId, year, month }).lean(),
    TimesheetEntry.find({ user: userId, date: { $gte: start, $lte: end } }).select('date durationMinutes').lean(),
    Attendance.find({ user: userId, date: { $gte: start, $lte: end } }).lean(),
  ]);

  const holidayByDate = new Map(holidays.map((holiday) => [holiday.date, holiday]));
  const attendanceByDate = new Map(attendance.map((row) => [row.date, row]));
  const minutesByDate = new Map<string, { totalMinutes: number; entryCount: number }>();
  for (const entry of entries) {
    const current = minutesByDate.get(entry.date) ?? { totalMinutes: 0, entryCount: 0 };
    current.totalMinutes += entry.durationMinutes;
    current.entryCount += 1;
    minutesByDate.set(entry.date, current);
  }

  const summary = summarizeEntries(entries.map((entry) => ({ date: entry.date, durationMinutes: entry.durationMinutes })));
  return {
    year,
    month,
    today,
    timesheet: timesheet ? mapTimesheet({ ...timesheet, totalMinutes: summary.monthlyTotalMinutes }) : null,
    ...summary,
    days: days.map((date) => {
      const holiday = holidayByDate.get(date);
      const leave = leaves.find((item) => item.startDate <= date && item.endDate >= date);
      const fill = evaluateFillability({
        date,
        today,
        isHoliday: Boolean(holiday),
        isOnApprovedLeave: Boolean(leave),
        timesheetStatus: timesheet?.status ?? null,
      });
      const totals = minutesByDate.get(date);
      const punch = attendanceByDate.get(date);
      return {
        date,
        weekday: weekdayIndex(date),
        isWeekend: isWeekendDate(date),
        isHoliday: Boolean(holiday),
        holidayName: holiday?.name ?? null,
        isOnLeave: Boolean(leave),
        leaveType: leave?.type ?? null,
        isFuture: isFutureDate(date, today),
        isPreviousMonth: isPreviousMonth(date, today),
        isFillable: fill.isFillable,
        lockReasons: fill.lockReasons,
        totalMinutes: totals?.totalMinutes ?? 0,
        entryCount: totals?.entryCount ?? 0,
        attendance: punch ? mapAttendance(punch) : null,
      };
    }),
  };
}
