import { Types } from 'mongoose';
import { env } from '../config/env';
import { MAX_ENTRIES_PER_DAY } from '../config/constants';
import { Holiday } from '../models/Holiday';
import { Leave } from '../models/Leave';
import { Project } from '../models/Project';
import { Task } from '../models/Task';
import { Timesheet } from '../models/Timesheet';
import { TimesheetEntry } from '../models/TimesheetEntry';
import type { ActorContext } from '../types/actor';
import type { LockReason, TimesheetStatus } from '../types/enums';
import { AppError } from '../utils/AppError';
import { monthKey, todayDateString } from '../utils/dates';
import { evaluateFillability, evaluateStructuralLock, lockMessage } from '../utils/fillability';
import { pageMeta } from '../utils/http';
import { mapEntry, mapTimesheet, mapUser, isUserLike } from '../utils/mappers';
import { isDuplicateKeyError } from '../utils/mongo';
import { durationMinutes, rangesOverlap, timeToMinutes } from '../utils/time';
import { summarizeEntries } from '../utils/totals';
import { EmployeeProfile } from '../models/EmployeeProfile';
import type { EntryBody, MonthQuery } from '../validators/timesheet.validator';
import { assertCanManageUser, assertCanViewUser, directReportIds } from './access.service';
import { recordAudit } from './audit.service';
import { notify, notifyManagerOrAdmins } from './notification.service';

function throwLocked(reasons: LockReason[]) {
  const code = reasons.includes('pending_approval') || reasons.includes('approved') ? 'TIMESHEET_LOCKED' : 'NOT_FILLABLE';
  throw new AppError(409, code, lockMessage(reasons), { lockReasons: reasons });
}

async function dayContext(userId: string, date: string) {
  const today = todayDateString(env.COMPANY_TIMEZONE);
  const [yearText, monthText] = date.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const [holiday, leave, timesheet] = await Promise.all([
    Holiday.findOne({ date }).lean(),
    Leave.findOne({ user: userId, status: 'approved', startDate: { $lte: date }, endDate: { $gte: date } }).lean(),
    Timesheet.findOne({ user: userId, year, month }).lean(),
  ]);
  const status = (timesheet?.status ?? null) as TimesheetStatus | null;
  return {
    today,
    year,
    month,
    holiday,
    leave,
    timesheet,
    fill: evaluateFillability({
      date,
      today,
      isHoliday: Boolean(holiday),
      isOnApprovedLeave: Boolean(leave),
      timesheetStatus: status,
    }),
    structural: evaluateStructuralLock({ date, today, timesheetStatus: status }),
  };
}

async function getOrCreateTimesheet(userId: string, year: number, month: number) {
  const existing = await Timesheet.findOne({ user: userId, year, month });
  if (existing) return existing;
  try {
    return await Timesheet.create({ user: userId, year, month, status: 'draft', totalMinutes: 0 });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      const raced = await Timesheet.findOne({ user: userId, year, month });
      if (raced) return raced;
    }
    throw error;
  }
}

async function recalc(timesheetId: string) {
  const rows = await TimesheetEntry.aggregate<{ total: number }>([
    { $match: { timesheet: new Types.ObjectId(timesheetId) } },
    { $group: { _id: null, total: { $sum: '$durationMinutes' } } },
  ]);
  const total = rows[0]?.total ?? 0;
  await Timesheet.updateOne({ _id: timesheetId }, { totalMinutes: total });
  return total;
}

async function totalsFor(userId: string, date: string, timesheetId: string) {
  const [dayRows, monthTotal] = await Promise.all([
    TimesheetEntry.find({ user: userId, date }).select('durationMinutes'),
    recalc(timesheetId),
  ]);
  return {
    dayTotalMinutes: dayRows.reduce((sum, row) => sum + row.durationMinutes, 0),
    monthTotalMinutes: monthTotal,
  };
}

async function assertProjectLoggable(userId: string, projectId: string) {
  const project = await Project.findById(projectId);
  if (!project || project.status !== 'active') {
    throw new AppError(409, 'PROJECT_UNAVAILABLE', 'Project is not available for time entry');
  }
  const members = project.members.map((member) => String(member));
  if (members.length > 0 && !members.includes(userId) && String(project.manager) !== userId) {
    throw new AppError(403, 'FORBIDDEN', 'You are not a member of this project');
  }
  return project;
}

async function resolveWork(actorId: string, body: EntryBody) {
  if (body.workType === 'assigned') {
    const task = await Task.findById(body.taskId);
    if (!task) throw new AppError(404, 'NOT_FOUND', 'Task not found');
    if (String(task.assignedTo) !== actorId) throw new AppError(403, 'FORBIDDEN', 'This task is not assigned to you');
    if (task.status === 'cancelled') throw new AppError(409, 'TASK_CANCELLED', 'Cancelled tasks cannot be used on a timesheet');
    return { taskId: task._id, projectId: task.project, workType: 'assigned' as const };
  }
  if (body.projectId) await assertProjectLoggable(actorId, body.projectId);
  return { taskId: undefined, projectId: body.projectId, workType: 'unassigned' as const };
}

function parsedDuration(startTime: string, endTime: string) {
  const minutes = durationMinutes(startTime, endTime);
  if (minutes == null) throw new AppError(422, 'INVALID_TIME_RANGE', 'End time must be after start time');
  return { startMinutes: timeToMinutes(startTime), endMinutes: timeToMinutes(endTime), durationMinutes: minutes };
}

async function assertNoOverlap(userId: string, date: string, startMinutes: number, endMinutes: number, exceptId?: string) {
  const siblings = await TimesheetEntry.find({
    user: userId,
    date,
    ...(exceptId ? { _id: { $ne: exceptId } } : {}),
  }).select('startMinutes endMinutes');
  if (siblings.some((row) => rangesOverlap(startMinutes, endMinutes, row.startMinutes, row.endMinutes))) {
    throw new AppError(409, 'OVERLAPPING_ENTRY', 'Time entries cannot overlap');
  }
}

async function loadEntries(filter: Record<string, unknown>) {
  return TimesheetEntry.find(filter)
    .populate('project', 'name code')
    .populate('task', 'title')
    .sort({ date: 1, startMinutes: 1 });
}

async function loadTimesheet(id: string) {
  return Timesheet.findById(id).populate('user', 'email firstName lastName role isActive lastLoginAt').populate('reviewedBy', 'email firstName lastName role isActive lastLoginAt');
}

export const timesheetService = {
  async getMonth(actor: ActorContext, query: MonthQuery) {
    const userId = query.userId ?? actor.id;
    await assertCanViewUser(actor, userId);
    const timesheet = await Timesheet.findOne({ user: userId, year: query.year, month: query.month }).populate(
      'reviewedBy',
      'email firstName lastName role isActive lastLoginAt',
    );
    const entries = timesheet ? await loadEntries({ timesheet: timesheet._id }) : [];
    const summary = summarizeEntries(entries.map((entry) => ({ date: entry.date, durationMinutes: entry.durationMinutes })));
    const mapped = timesheet ? mapTimesheet({ ...timesheet.toObject(), totalMinutes: summary.monthlyTotalMinutes }) : null;
    return { timesheet: mapped, entries: entries.map((entry) => mapEntry(entry)), ...summary };
  },

  async getDaily(actor: ActorContext, date: string, userId = actor.id) {
    await assertCanViewUser(actor, userId);
    const context = await dayContext(userId, date);
    const entries = await loadEntries({ user: userId, date });
    const totalMinutes = entries.reduce((sum, entry) => sum + entry.durationMinutes, 0);
    return {
      date,
      isFillable: context.fill.isFillable,
      lockReasons: context.fill.lockReasons,
      timesheet: context.timesheet ? mapTimesheet(context.timesheet) : null,
      entries: entries.map((entry) => mapEntry(entry)),
      totalMinutes,
    };
  },

  async getById(actor: ActorContext, id: string) {
    const timesheet = await loadTimesheet(id);
    if (!timesheet) throw new AppError(404, 'NOT_FOUND', 'Timesheet not found');
    const ownerId = isUserLike(timesheet.user) ? String(timesheet.user._id) : String(timesheet.user);
    await assertCanViewUser(actor, ownerId);
    const entries = await loadEntries({ timesheet: timesheet._id });
    const summary = summarizeEntries(entries.map((entry) => ({ date: entry.date, durationMinutes: entry.durationMinutes })));
    return {
      timesheet: mapTimesheet({ ...timesheet.toObject(), totalMinutes: summary.monthlyTotalMinutes }),
      entries: entries.map((entry) => mapEntry(entry)),
      ...summary,
    };
  },

  async listPending(actor: ActorContext, page: number, limit: number) {
    const filter: Record<string, unknown> = { status: 'submitted' };
    if (actor.role === 'manager') {
      filter.user = { $in: await directReportIds(actor.id) };
    } else {
      filter.user = { $ne: actor.id };
    }
    const skip = (page - 1) * limit;
    const [rows, total] = await Promise.all([
      Timesheet.find(filter)
        .sort({ submittedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('user', 'email firstName lastName role isActive lastLoginAt'),
      Timesheet.countDocuments(filter),
    ]);
    const userIds = rows.map((row) => String(row.user && typeof row.user === 'object' ? row.user._id ?? row.user : row.user));
    const profiles = await EmployeeProfile.find({ user: { $in: userIds } }).select('user employeeCode');
    const codes = new Map(profiles.map((profile) => [String(profile.user), profile.employeeCode]));
    return {
      rows: rows.map((row) => {
        const employee = isUserLike(row.user) ? mapUser(row.user) : null;
        return {
          ...mapTimesheet(row),
          employee: employee ? { ...employee, employeeCode: codes.get(employee.id) ?? null } : null,
        };
      }),
      meta: pageMeta(page, limit, total),
    };
  },

  async createEntry(actor: ActorContext, body: EntryBody) {
    const timing = parsedDuration(body.startTime, body.endTime);
    const context = await dayContext(actor.id, body.date);
    if (!context.fill.isFillable) throwLocked(context.fill.lockReasons);
    const work = await resolveWork(actor.id, body);
    await assertNoOverlap(actor.id, body.date, timing.startMinutes, timing.endMinutes);
    const count = await TimesheetEntry.countDocuments({ user: actor.id, date: body.date });
    if (count >= MAX_ENTRIES_PER_DAY) throw new AppError(409, 'ENTRY_LIMIT', 'Daily entry limit reached');

    const timesheet = await getOrCreateTimesheet(actor.id, context.year, context.month);
    if (timesheet.status === 'submitted' || timesheet.status === 'approved') {
      throwLocked(timesheet.status === 'approved' ? ['approved'] : ['pending_approval']);
    }
    const entry = await TimesheetEntry.create({
      timesheet: timesheet._id,
      user: actor.id,
      date: body.date,
      project: work.projectId,
      task: work.taskId,
      workType: work.workType,
      description: body.description,
      startTime: body.startTime,
      endTime: body.endTime,
      ...timing,
    });
    const totals = await totalsFor(actor.id, body.date, String(timesheet._id));
    await recordAudit({
      actorId: actor.id,
      action: 'ENTRY_CREATED',
      entityType: 'timesheet_entry',
      entityId: String(entry._id),
      after: { date: body.date, workType: work.workType, durationMinutes: timing.durationMinutes },
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
    const populated = await loadEntries({ _id: entry._id });
    return {
      entry: mapEntry(populated[0] ?? entry),
      timesheet: mapTimesheet({ ...timesheet.toObject(), totalMinutes: totals.monthTotalMinutes }),
      ...totals,
    };
  },

  async updateEntry(actor: ActorContext, entryId: string, body: EntryBody) {
    const entry = await TimesheetEntry.findById(entryId);
    if (!entry) throw new AppError(404, 'NOT_FOUND', 'Timesheet entry not found');
    if (String(entry.user) !== actor.id) throw new AppError(403, 'FORBIDDEN', 'You cannot edit this entry');
    const timing = parsedDuration(body.startTime, body.endTime);
    const current = await dayContext(actor.id, entry.date);
    if (current.structural.locked) throwLocked(current.structural.lockReasons);
    if (body.date !== entry.date) {
      const next = await dayContext(actor.id, body.date);
      if (!next.fill.isFillable) throwLocked(next.fill.lockReasons);
    }
    const work = await resolveWork(actor.id, body);
    await assertNoOverlap(actor.id, body.date, timing.startMinutes, timing.endMinutes, entryId);

    const previousTimesheetId = String(entry.timesheet);
    const nextContext = await dayContext(actor.id, body.date);
    const nextTimesheet = await getOrCreateTimesheet(actor.id, nextContext.year, nextContext.month);
    if (nextTimesheet.status === 'submitted' || nextTimesheet.status === 'approved') {
      throwLocked(nextTimesheet.status === 'approved' ? ['approved'] : ['pending_approval']);
    }

    entry.timesheet = nextTimesheet._id;
    entry.date = body.date;
    entry.set('project', work.projectId ?? undefined);
    entry.set('task', work.taskId ?? undefined);
    entry.workType = work.workType;
    entry.description = body.description;
    entry.startTime = body.startTime;
    entry.endTime = body.endTime;
    entry.startMinutes = timing.startMinutes;
    entry.endMinutes = timing.endMinutes;
    entry.durationMinutes = timing.durationMinutes;
    await entry.save();

    const monthTotalMinutes = await recalc(String(nextTimesheet._id));
    if (previousTimesheetId !== String(nextTimesheet._id)) await recalc(previousTimesheetId);
    const dayRows = await TimesheetEntry.find({ user: actor.id, date: body.date }).select('durationMinutes');
    await recordAudit({
      actorId: actor.id,
      action: 'ENTRY_UPDATED',
      entityType: 'timesheet_entry',
      entityId: entryId,
      after: { date: body.date, durationMinutes: timing.durationMinutes },
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
    const populated = await loadEntries({ _id: entry._id });
    return {
      entry: mapEntry(populated[0] ?? entry),
      timesheet: mapTimesheet({ ...nextTimesheet.toObject(), totalMinutes: monthTotalMinutes }),
      dayTotalMinutes: dayRows.reduce((sum, row) => sum + row.durationMinutes, 0),
      monthTotalMinutes,
    };
  },

  async deleteEntry(actor: ActorContext, entryId: string) {
    const entry = await TimesheetEntry.findById(entryId);
    if (!entry) throw new AppError(404, 'NOT_FOUND', 'Timesheet entry not found');
    if (String(entry.user) !== actor.id) throw new AppError(403, 'FORBIDDEN', 'You cannot delete this entry');
    const context = await dayContext(actor.id, entry.date);
    if (context.structural.locked) throwLocked(context.structural.lockReasons);
    const timesheetId = String(entry.timesheet);
    const date = entry.date;
    await entry.deleteOne();
    const monthTotalMinutes = await recalc(timesheetId);
    const dayRows = await TimesheetEntry.find({ user: actor.id, date }).select('durationMinutes');
    await recordAudit({
      actorId: actor.id,
      action: 'ENTRY_DELETED',
      entityType: 'timesheet_entry',
      entityId: entryId,
      before: { date, durationMinutes: entry.durationMinutes },
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
    const timesheet = await Timesheet.findById(timesheetId);
    return {
      id: entryId,
      deleted: true,
      dayTotalMinutes: dayRows.reduce((sum, row) => sum + row.durationMinutes, 0),
      monthTotalMinutes,
      timesheet: timesheet ? mapTimesheet({ ...timesheet.toObject(), totalMinutes: monthTotalMinutes }) : null,
    };
  },

  async submit(actor: ActorContext, id: string) {
    const timesheet = await Timesheet.findById(id);
    if (!timesheet) throw new AppError(404, 'NOT_FOUND', 'Timesheet not found');
    if (String(timesheet.user) !== actor.id) throw new AppError(403, 'FORBIDDEN', 'You cannot submit this timesheet');
    const today = todayDateString(env.COMPANY_TIMEZONE);
    const sheetKey = `${timesheet.year}-${String(timesheet.month).padStart(2, '0')}`;
    if (sheetKey < monthKey(today)) throw new AppError(409, 'PREVIOUS_MONTH', 'Previous months are locked.');
    if (sheetKey > monthKey(today)) throw new AppError(409, 'NOT_FILLABLE', 'Future dates cannot be filled.');
    if (timesheet.status !== 'draft' && timesheet.status !== 'rejected') {
      throw new AppError(409, 'INVALID_STATUS', 'Only draft or rejected timesheets can be submitted');
    }
    const count = await TimesheetEntry.countDocuments({ timesheet: timesheet._id });
    if (count === 0) throw new AppError(409, 'EMPTY_TIMESHEET', 'Add at least one entry before submitting');
    const totalMinutes = await recalc(String(timesheet._id));
    const updated = await Timesheet.findOneAndUpdate(
      { _id: timesheet._id, status: { $in: ['draft', 'rejected'] } },
      {
        $set: { status: 'submitted', submittedAt: new Date(), totalMinutes },
        $unset: { rejectionReason: 1, reviewedBy: 1, reviewedAt: 1 },
      },
      { new: true },
    );
    if (!updated) throw new AppError(409, 'INVALID_STATUS', 'Timesheet status changed. Refresh and try again');
    await notifyManagerOrAdmins(
      actor.id,
      {
        type: 'timesheet_submitted',
        title: 'Timesheet submitted',
        message: `${actor.email} submitted a timesheet for ${sheetKey}.`,
        metadata: { timesheetId: String(updated._id), year: updated.year, month: updated.month },
      },
      actor.id,
    );
    await recordAudit({
      actorId: actor.id,
      action: 'TIMESHEET_SUBMITTED',
      entityType: 'timesheet',
      entityId: String(updated._id),
      after: { status: 'submitted', totalMinutes },
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
    return mapTimesheet(updated);
  },

  async approve(actor: ActorContext, id: string) {
    return review(actor, id, 'approved');
  },

  async reject(actor: ActorContext, id: string, reason: string) {
    return review(actor, id, 'rejected', reason);
  },
};

async function review(actor: ActorContext, id: string, status: 'approved' | 'rejected', reason?: string) {
  const timesheet = await Timesheet.findById(id);
  if (!timesheet) throw new AppError(404, 'NOT_FOUND', 'Timesheet not found');
  if (timesheet.status !== 'submitted') throw new AppError(409, 'INVALID_STATUS', 'Only submitted timesheets can be reviewed');
  await assertCanManageUser(actor, String(timesheet.user));
  const updated = await Timesheet.findOneAndUpdate(
    { _id: timesheet._id, status: 'submitted' },
    {
      status,
      reviewedBy: actor.id,
      reviewedAt: new Date(),
      rejectionReason: status === 'rejected' ? reason : undefined,
    },
    { new: true },
  );
  if (!updated) throw new AppError(409, 'INVALID_STATUS', 'Timesheet status changed. Refresh and try again');
  await notify(String(timesheet.user), {
    type: status === 'approved' ? 'timesheet_approved' : 'timesheet_rejected',
    title: status === 'approved' ? 'Timesheet approved' : 'Timesheet rejected',
    message: status === 'approved' ? 'Your timesheet was approved.' : `Your timesheet was rejected: ${reason}`,
    metadata: { timesheetId: String(updated._id) },
  });
  await recordAudit({
    actorId: actor.id,
    action: status === 'approved' ? 'TIMESHEET_APPROVED' : 'TIMESHEET_REJECTED',
    entityType: 'timesheet',
    entityId: String(updated._id),
    after: { status, reason: reason ?? null },
    ip: actor.ip,
    userAgent: actor.userAgent,
  });
  return mapTimesheet(updated);
}
