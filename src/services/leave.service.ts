import type { FilterQuery, HydratedDocument } from 'mongoose';
import { env } from '../config/env';
import { MAX_LEAVE_DAYS } from '../config/constants';
import { Holiday } from '../models/Holiday';
import { Leave, type ILeave } from '../models/Leave';
import { Timesheet } from '../models/Timesheet';
import { TimesheetEntry } from '../models/TimesheetEntry';
import type { ActorContext } from '../types/actor';
import { AppError } from '../utils/AppError';
import { countWorkingDays, diffDays, eachDateInclusive, isWeekendDate, monthKey, todayDateString } from '../utils/dates';
import { pageMeta } from '../utils/http';
import { isUserLike, mapUser } from '../utils/mappers';
import type { ApprovedLeavesQuery, CreateLeaveBody, ListLeavesQuery } from '../validators/leave.validator';
import { assertCanManageUser, assertCanViewUser, directReportIds } from './access.service';
import { recordAudit } from './audit.service';
import { notify, notifyManagerOrAdmins } from './notification.service';

function mapLeave(leave: {
  _id: unknown;
  type: ILeave['type'];
  startDate: string;
  endDate: string;
  dayCount: number;
  reason: string;
  status: ILeave['status'];
  rejectionReason?: string | null;
  reviewedAt?: Date | null;
  createdAt?: Date;
  user: unknown;
  reviewedBy?: unknown;
}) {
  return {
    id: String(leave._id),
    type: leave.type,
    startDate: leave.startDate,
    endDate: leave.endDate,
    dayCount: leave.dayCount,
    reason: leave.reason,
    status: leave.status,
    rejectionReason: leave.rejectionReason ?? null,
    reviewedAt: leave.reviewedAt ?? null,
    createdAt: leave.createdAt ?? null,
    user: isUserLike(leave.user) ? mapUser(leave.user) : { id: String(leave.user) },
    reviewedBy: isUserLike(leave.reviewedBy)
      ? { id: String(leave.reviewedBy._id), firstName: leave.reviewedBy.firstName, lastName: leave.reviewedBy.lastName }
      : null,
  };
}

type LeaveDoc = HydratedDocument<ILeave>;
type LeaveQuery = { populate(path: string, select: string): LeaveQuery };

function withUsers(query: LeaveQuery): Promise<LeaveDoc[]> {
  return query
    .populate('user', 'email firstName lastName role isActive lastLoginAt')
    .populate('reviewedBy', 'email firstName lastName role isActive lastLoginAt') as unknown as Promise<LeaveDoc[]>;
}

async function workingDayCount(startDate: string, endDate: string) {
  if (diffDays(startDate, endDate) > MAX_LEAVE_DAYS - 1) {
    throw new AppError(400, 'INVALID_RANGE', `Leave cannot exceed ${MAX_LEAVE_DAYS} days`);
  }
  const dates = eachDateInclusive(startDate, endDate);
  const holidays = await Holiday.find({ date: { $gte: startDate, $lte: endDate } }).select('date').lean();
  const holidayDates = new Set(holidays.map((holiday) => holiday.date));
  return { dates, holidayDates, dayCount: countWorkingDays(dates, holidayDates) };
}

export const leaveService = {
  async create(actor: ActorContext, body: CreateLeaveBody) {
    const { dayCount } = await workingDayCount(body.startDate, body.endDate);
    if (dayCount < 1) throw new AppError(422, 'NO_WORKING_DAYS', 'The leave range does not include a working day');
    const overlap = await Leave.findOne({
      user: actor.id,
      status: { $in: ['pending', 'approved'] },
      startDate: { $lte: body.endDate },
      endDate: { $gte: body.startDate },
    }).select('_id');
    if (overlap) throw new AppError(409, 'LEAVE_OVERLAP', 'This range overlaps an existing leave request');

    const leave = await Leave.create({
      user: actor.id,
      type: body.type,
      startDate: body.startDate,
      endDate: body.endDate,
      dayCount,
      reason: body.reason,
      status: 'pending',
    });
    await notifyManagerOrAdmins(
      actor.id,
      {
        type: 'leave_submitted',
        title: 'Leave request',
        message: `${actor.email} requested ${body.type} leave from ${body.startDate} to ${body.endDate}.`,
        metadata: { leaveId: String(leave._id) },
      },
      actor.id,
    );
    await recordAudit({
      actorId: actor.id,
      action: 'LEAVE_REQUESTED',
      entityType: 'leave',
      entityId: String(leave._id),
      after: { startDate: body.startDate, endDate: body.endDate, dayCount },
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
    const rows = await withUsers(Leave.find({ _id: leave._id }));
    return mapLeave(rows[0] ?? leave);
  },

  async list(actor: ActorContext, query: ListLeavesQuery) {
    const filter: FilterQuery<ILeave> = {};
    if (query.status) filter.status = query.status;
    if (query.userId) {
      await assertCanViewUser(actor, query.userId);
      filter.user = query.userId;
    } else if (actor.role === 'employee') {
      filter.user = actor.id;
    } else if (actor.role === 'manager') {
      filter.user = { $in: [actor.id, ...(await directReportIds(actor.id))] };
    }
    return paginate(filter, query.page, query.limit);
  },

  async approved(actor: ActorContext, query: ApprovedLeavesQuery) {
    const year = query.year ?? Number(todayDateString(env.COMPANY_TIMEZONE).slice(0, 4));
    const start = `${year}-01-01`;
    const end = `${year}-12-31`;
    const filter: FilterQuery<ILeave> = {
      status: 'approved',
      startDate: { $lte: end },
      endDate: { $gte: start },
    };
    if (query.userId) {
      await assertCanViewUser(actor, query.userId);
      filter.user = query.userId;
    } else if (actor.role === 'employee') {
      filter.user = actor.id;
    } else if (actor.role === 'manager') {
      filter.user = { $in: [actor.id, ...(await directReportIds(actor.id))] };
    }
    return paginate(filter, query.page, query.limit);
  },

  async pending(actor: ActorContext, page: number, limit: number) {
    const filter: FilterQuery<ILeave> = { status: 'pending' };
    if (actor.role === 'manager') filter.user = { $in: await directReportIds(actor.id) };
    else filter.user = { $ne: actor.id };
    return paginate(filter, page, limit);
  },

  async get(actor: ActorContext, id: string) {
    const rows = await withUsers(Leave.find({ _id: id }));
    const leave = rows[0];
    if (!leave) throw new AppError(404, 'NOT_FOUND', 'Leave request not found');
    const userId = isUserLike(leave.user) ? String(leave.user._id) : String(leave.user);
    await assertCanViewUser(actor, userId);
    return mapLeave(leave);
  },

  async approve(actor: ActorContext, id: string) {
    const leave = await Leave.findById(id);
    if (!leave) throw new AppError(404, 'NOT_FOUND', 'Leave request not found');
    if (leave.status !== 'pending') throw new AppError(409, 'INVALID_STATUS', 'Only pending leave can be approved');
    await assertCanManageUser(actor, String(leave.user));
    const { dates, holidayDates, dayCount } = await workingDayCount(leave.startDate, leave.endDate);
    if (dayCount < 1) throw new AppError(422, 'NO_WORKING_DAYS', 'The leave range does not include a working day');
    const workingDates = dates.filter((date) => !isWeekendDate(date) && !holidayDates.has(date));
    const entries = await TimesheetEntry.find({ user: leave.user, date: { $in: workingDates } }).select('date');
    if (entries.length > 0) {
      const conflictDates = [...new Set(entries.map((entry) => entry.date))];
      throw new AppError(409, 'LEAVE_HAS_TIME_ENTRIES', 'Remove timesheet entries on these dates before approving leave', { dates: conflictDates });
    }
    const months = [...new Set(workingDates.map((date) => monthKey(date)))];
    const locked = await Timesheet.findOne({
      user: leave.user,
      status: { $in: ['submitted', 'approved'] },
      $or: months.map((key) => ({ year: Number(key.slice(0, 4)), month: Number(key.slice(5, 7)) })),
    }).select('_id');
    if (locked) throw new AppError(409, 'TIMESHEET_LOCKED', 'A submitted or approved timesheet covers this leave');

    const updated = await Leave.findOneAndUpdate(
      { _id: leave._id, status: 'pending' },
      { status: 'approved', dayCount, reviewedBy: actor.id, reviewedAt: new Date(), rejectionReason: undefined },
      { new: true },
    );
    if (!updated) throw new AppError(409, 'INVALID_STATUS', 'Leave status changed. Refresh and try again');
    await notify(String(leave.user), {
      type: 'leave_approved',
      title: 'Leave approved',
      message: `Your leave from ${leave.startDate} to ${leave.endDate} was approved.`,
      metadata: { leaveId: String(leave._id) },
    });
    await recordAudit({
      actorId: actor.id,
      action: 'LEAVE_APPROVED',
      entityType: 'leave',
      entityId: id,
      after: { status: 'approved', dayCount },
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
    const rows = await withUsers(Leave.find({ _id: updated._id }));
    return mapLeave(rows[0] ?? updated);
  },

  async reject(actor: ActorContext, id: string, reason: string) {
    const leave = await Leave.findById(id);
    if (!leave) throw new AppError(404, 'NOT_FOUND', 'Leave request not found');
    if (leave.status !== 'pending') throw new AppError(409, 'INVALID_STATUS', 'Only pending leave can be rejected');
    await assertCanManageUser(actor, String(leave.user));
    const updated = await Leave.findOneAndUpdate(
      { _id: leave._id, status: 'pending' },
      { status: 'rejected', reviewedBy: actor.id, reviewedAt: new Date(), rejectionReason: reason },
      { new: true },
    );
    if (!updated) throw new AppError(409, 'INVALID_STATUS', 'Leave status changed. Refresh and try again');
    await notify(String(leave.user), {
      type: 'leave_rejected',
      title: 'Leave rejected',
      message: `Your leave request was rejected: ${reason}`,
      metadata: { leaveId: String(leave._id) },
    });
    await recordAudit({
      actorId: actor.id,
      action: 'LEAVE_REJECTED',
      entityType: 'leave',
      entityId: id,
      after: { status: 'rejected', reason },
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
    const rows = await withUsers(Leave.find({ _id: updated._id }));
    return mapLeave(rows[0] ?? updated);
  },

  async cancel(actor: ActorContext, id: string) {
    const leave = await Leave.findById(id);
    if (!leave) throw new AppError(404, 'NOT_FOUND', 'Leave request not found');
    const ownerId = String(leave.user);
    const isOwner = actor.id === ownerId;
    if (leave.status === 'pending' && isOwner) {
      return close(actor, leave, 'cancelled');
    }
    if (leave.status === 'pending' && !isOwner) {
      await assertCanManageUser(actor, ownerId);
      return close(actor, leave, 'cancelled');
    }
    if (leave.status === 'approved' && actor.role === 'admin') {
      return close(actor, leave, 'cancelled');
    }
    throw new AppError(409, 'INVALID_STATUS', 'This leave request cannot be cancelled');
  },
};

async function close(actor: ActorContext, leave: { _id: unknown; user: unknown; status: string }, status: 'cancelled') {
  const updated = await Leave.findOneAndUpdate({ _id: leave._id, status: leave.status }, { status }, { new: true });
  if (!updated) throw new AppError(409, 'INVALID_STATUS', 'Leave status changed. Refresh and try again');
  await recordAudit({
    actorId: actor.id,
    action: 'LEAVE_CANCELLED',
    entityType: 'leave',
    entityId: String(leave._id),
    after: { status },
    ip: actor.ip,
    userAgent: actor.userAgent,
  });
  const rows = await withUsers(Leave.find({ _id: updated._id }));
  return mapLeave(rows[0] ?? updated);
}

async function paginate(filter: FilterQuery<ILeave>, page: number, limit: number) {
  const skip = (page - 1) * limit;
  const [rows, total] = await Promise.all([
    withUsers(Leave.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit)),
    Leave.countDocuments(filter),
  ]);
  return { rows: rows.map((row) => mapLeave(row)), meta: pageMeta(page, limit, total) };
}
