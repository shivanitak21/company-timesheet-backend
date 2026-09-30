import { env } from '../config/env';
import { MAX_RANGE_DAYS } from '../config/constants';
import { Attendance } from '../models/Attendance';
import type { ActorContext } from '../types/actor';
import type { Platform } from '../types/enums';
import { AppError } from '../utils/AppError';
import { diffDays, todayDateString } from '../utils/dates';
import { mapAttendance } from '../utils/mappers';
import { isDuplicateKeyError } from '../utils/mongo';
import type { CorrectAttendanceBody, HistoryQuery } from '../validators/attendance.validator';
import { assertCanManageUser, assertCanViewUser } from './access.service';
import { recordAudit } from './audit.service';

function assertRange(from: string, to: string) {
  if (from > to) throw new AppError(400, 'INVALID_RANGE', 'Start date must be on or before end date');
  if (diffDays(from, to) > MAX_RANGE_DAYS - 1) {
    throw new AppError(400, 'INVALID_RANGE', `Date range cannot exceed ${MAX_RANGE_DAYS} days`);
  }
}

export const attendanceService = {
  async checkIn(actor: ActorContext, input: { notes?: string; platform: Platform }) {
    const date = todayDateString(env.COMPANY_TIMEZONE);
    const existing = await Attendance.findOne({ user: actor.id, date });
    if (existing?.status === 'checked_in') {
      throw new AppError(409, 'ALREADY_CHECKED_IN', 'You are already checked in');
    }
    if (existing?.status === 'checked_out') {
      throw new AppError(409, 'ALREADY_COMPLETE', 'Attendance for today is already complete');
    }
    try {
      const record = await Attendance.create({
        user: actor.id,
        date,
        checkInAt: new Date(),
        status: 'checked_in',
        notes: input.notes || undefined,
        platform: input.platform,
      });
      await recordAudit({
        actorId: actor.id,
        action: 'CHECK_IN',
        entityType: 'attendance',
        entityId: String(record._id),
        after: { date, checkInAt: record.checkInAt },
        ip: actor.ip,
        userAgent: actor.userAgent,
      });
      return mapAttendance(record);
    } catch (error) {
      if (isDuplicateKeyError(error)) throw new AppError(409, 'ALREADY_CHECKED_IN', 'You are already checked in');
      throw error;
    }
  },

  async checkOut(actor: ActorContext, input: { notes?: string; platform: Platform }) {
    const date = todayDateString(env.COMPANY_TIMEZONE);
    const open = await Attendance.findOne({ user: actor.id, date, status: 'checked_in' });
    if (!open) throw new AppError(409, 'NOT_CHECKED_IN', 'Check in before checking out');
    const checkOutAt = new Date();
    const workMinutes = Math.max(0, Math.round((checkOutAt.getTime() - open.checkInAt.getTime()) / 60000));
    const updated = await Attendance.findOneAndUpdate(
      { _id: open._id, status: 'checked_in' },
      {
        status: 'checked_out',
        checkOutAt,
        workMinutes,
        ...(input.notes ? { notes: input.notes } : {}),
        platform: input.platform,
      },
      { new: true },
    );
    if (!updated) throw new AppError(409, 'NOT_CHECKED_IN', 'Check in before checking out');
    await recordAudit({
      actorId: actor.id,
      action: 'CHECK_OUT',
      entityType: 'attendance',
      entityId: String(updated._id),
      after: { date, checkOutAt, workMinutes },
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
    return mapAttendance(updated);
  },

  async today(actor: ActorContext) {
    const date = todayDateString(env.COMPANY_TIMEZONE);
    const record = await Attendance.findOne({ user: actor.id, date });
    return { attendance: record ? mapAttendance(record) : null };
  },

  async history(actor: ActorContext, query: HistoryQuery) {
    const today = todayDateString(env.COMPANY_TIMEZONE);
    const from = query.from ?? `${today.slice(0, 7)}-01`;
    const to = query.to ?? today;
    assertRange(from, to);
    const userId = query.userId ?? actor.id;
    await assertCanViewUser(actor, userId);
    const rows = await Attendance.find({ user: userId, date: { $gte: from, $lte: to } }).sort({ date: -1 });
    return {
      from,
      to,
      userId,
      rows: rows.map((row) => mapAttendance(row)),
    };
  },

  async correct(actor: ActorContext, id: string, body: CorrectAttendanceBody) {
    const record = await Attendance.findById(id);
    if (!record) throw new AppError(404, 'NOT_FOUND', 'Attendance record not found');
    const ownerId = String(record.user);
    if (actor.role !== 'admin') await assertCanManageUser(actor, ownerId);

    const checkInAt = body.checkInAt ? new Date(body.checkInAt) : record.checkInAt;
    const checkOutAt = body.checkOutAt ? new Date(body.checkOutAt) : record.checkOutAt;
    if (Number.isNaN(checkInAt.getTime()) || (checkOutAt && Number.isNaN(checkOutAt.getTime()))) {
      throw new AppError(422, 'VALIDATION_ERROR', 'Invalid attendance timestamp');
    }
    if (checkOutAt && checkOutAt <= checkInAt) {
      throw new AppError(422, 'INVALID_TIME_RANGE', 'Check-out must be after check-in');
    }

    const before = mapAttendance(record);
    record.checkInAt = checkInAt;
    if (checkOutAt) {
      record.checkOutAt = checkOutAt;
      record.status = 'checked_out';
      record.workMinutes = Math.max(0, Math.round((checkOutAt.getTime() - checkInAt.getTime()) / 60000));
    }
    if (body.notes !== undefined) record.notes = body.notes ?? undefined;
    await record.save();
    await recordAudit({
      actorId: actor.id,
      action: 'ATTENDANCE_CORRECTED',
      entityType: 'attendance',
      entityId: String(record._id),
      before,
      after: mapAttendance(record),
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
    return mapAttendance(record);
  },
};
