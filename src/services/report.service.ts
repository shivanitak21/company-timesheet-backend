import { MAX_RANGE_DAYS } from '../config/constants';
import { Attendance } from '../models/Attendance';
import { EmployeeProfile } from '../models/EmployeeProfile';
import { Holiday } from '../models/Holiday';
import { Leave } from '../models/Leave';
import { Timesheet } from '../models/Timesheet';
import { TimesheetEntry } from '../models/TimesheetEntry';
import { User } from '../models/User';
import type { ActorContext } from '../types/actor';
import type { LeaveType } from '../types/enums';
import { AppError } from '../utils/AppError';
import { countWorkingDays, diffDays, eachDateInclusive, monthBounds } from '../utils/dates';
import { pageMeta } from '../utils/http';
import { mapAttendance } from '../utils/mappers';
import { summarizeEntries } from '../utils/totals';
import { listAudit } from './audit.service';
import { resolveVisibleUserIds } from './access.service';

function assertRange(from: string, to: string) {
  if (from > to) throw new AppError(400, 'INVALID_RANGE', 'Start date must be on or before end date');
  if (diffDays(from, to) > MAX_RANGE_DAYS - 1) {
    throw new AppError(400, 'INVALID_RANGE', `Date range cannot exceed ${MAX_RANGE_DAYS} days`);
  }
}

async function pageUsers(actor: ActorContext, requestedUserId: string | undefined, page: number, limit: number) {
  const all = await resolveVisibleUserIds(actor, requestedUserId);
  const start = (page - 1) * limit;
  return { ids: all.slice(start, start + limit), total: all.length };
}

async function namesFor(ids: string[]) {
  const [users, profiles] = await Promise.all([
    User.find({ _id: { $in: ids } }).select('firstName lastName email'),
    EmployeeProfile.find({ user: { $in: ids } }).select('user employeeCode'),
  ]);
  const codes = new Map(profiles.map((profile) => [String(profile.user), profile.employeeCode]));
  return new Map(
    users.map((user) => [
      String(user._id),
      {
        userId: String(user._id),
        name: `${user.firstName} ${user.lastName}`.trim(),
        email: user.email,
        employeeCode: codes.get(String(user._id)) ?? null,
      },
    ]),
  );
}

export const reportService = {
  async attendance(actor: ActorContext, query: { from: string; to: string; userId?: string; page: number; limit: number }) {
    assertRange(query.from, query.to);
    const { ids, total } = await pageUsers(actor, query.userId, query.page, query.limit);
    const detailed = Boolean(query.userId);
    const [punches, names] = await Promise.all([
      Attendance.find({ user: { $in: ids }, date: { $gte: query.from, $lte: query.to } }).sort({ date: 1 }),
      namesFor(ids),
    ]);
    const grouped = new Map<string, typeof punches>();
    for (const punch of punches) {
      const key = String(punch.user);
      grouped.set(key, [...(grouped.get(key) ?? []), punch]);
    }
    const rows = ids.map((id) => {
      const days = grouped.get(id) ?? [];
      const identity = names.get(id) ?? { userId: id, name: 'Unknown', email: '', employeeCode: null };
      return {
        ...identity,
        totalWorkMinutes: days.reduce((sum, day) => sum + (day.workMinutes ?? 0), 0),
        daysPresent: days.length,
        days: detailed ? days.map((day) => mapAttendance(day)) : undefined,
      };
    });
    return { from: query.from, to: query.to, rows, meta: pageMeta(query.page, query.limit, total) };
  },

  async timesheets(actor: ActorContext, query: { year: number; month: number; userId?: string; page: number; limit: number }) {
    const { ids, total } = await pageUsers(actor, query.userId, query.page, query.limit);
    const { start, end } = monthBounds(query.year, query.month);
    const [entries, sheets, names] = await Promise.all([
      TimesheetEntry.find({ user: { $in: ids }, date: { $gte: start, $lte: end } }).select('user date durationMinutes').lean(),
      Timesheet.find({ user: { $in: ids }, year: query.year, month: query.month }).select('user status').lean(),
      namesFor(ids),
    ]);
    const statusByUser = new Map(sheets.map((sheet) => [String(sheet.user), sheet.status]));
    const rows = ids.map((id) => {
      const mine = entries.filter((entry) => String(entry.user) === id);
      const summary = summarizeEntries(mine.map((entry) => ({ date: entry.date, durationMinutes: entry.durationMinutes })));
      const identity = names.get(id) ?? { userId: id, name: 'Unknown', email: '', employeeCode: null };
      return {
        ...identity,
        status: statusByUser.get(id) ?? null,
        monthlyTotalMinutes: summary.monthlyTotalMinutes,
        weeklyTotals: summary.weeklyTotals,
      };
    });
    return { year: query.year, month: query.month, rows, meta: pageMeta(query.page, query.limit, total) };
  },

  async leaves(actor: ActorContext, query: { year: number; userId?: string; page: number; limit: number }) {
    const { ids, total } = await pageUsers(actor, query.userId, query.page, query.limit);
    const start = `${query.year}-01-01`;
    const end = `${query.year}-12-31`;
    const [leaves, holidays, names] = await Promise.all([
      Leave.find({
        user: { $in: ids },
        status: { $in: ['approved', 'pending'] },
        startDate: { $lte: end },
        endDate: { $gte: start },
      }).lean(),
      Holiday.find({ date: { $gte: start, $lte: end } }).select('date').lean(),
      namesFor(ids),
    ]);
    const holidayDates = new Set(holidays.map((holiday) => holiday.date));
    const rows = ids.map((id) => {
      const mine = leaves.filter((leave) => String(leave.user) === id);
      const byType: Record<LeaveType, number> = { annual: 0, sick: 0, unpaid: 0, other: 0 };
      let approvedDays = 0;
      let pendingDays = 0;
      for (const leave of mine) {
        const clippedStart = leave.startDate < start ? start : leave.startDate;
        const clippedEnd = leave.endDate > end ? end : leave.endDate;
        const days = countWorkingDays(eachDateInclusive(clippedStart, clippedEnd), holidayDates);
        if (leave.status === 'approved') {
          approvedDays += days;
          byType[leave.type] += days;
        } else {
          pendingDays += days;
        }
      }
      const identity = names.get(id) ?? { userId: id, name: 'Unknown', email: '', employeeCode: null };
      return { ...identity, approvedDays, pendingDays, byType };
    });
    return { year: query.year, rows, meta: pageMeta(query.page, query.limit, total) };
  },

  async audit(query: { page: number; limit: number; entityType?: string; actorId?: string }) {
    return listAudit(query);
  },
};