import { env } from '../config/env';
import { Holiday } from '../models/Holiday';
import type { ActorContext } from '../types/actor';
import { AppError } from '../utils/AppError';
import { todayDateString } from '../utils/dates';
import { isDuplicateKeyError } from '../utils/mongo';
import type { CreateHolidayBody, UpdateHolidayBody } from '../validators/holiday.validator';
import { recordAudit } from './audit.service';

function mapHoliday(holiday: { _id: unknown; name: string; date: string }) {
  return { id: String(holiday._id), name: holiday.name, date: holiday.date };
}

export const holidayService = {
  async list(year?: number) {
    const resolved = year ?? Number(todayDateString(env.COMPANY_TIMEZONE).slice(0, 4));
    const rows = await Holiday.find({ date: { $gte: `${resolved}-01-01`, $lte: `${resolved}-12-31` } }).sort({ date: 1 });
    return { year: resolved, rows: rows.map((row) => mapHoliday(row)) };
  },

  async create(actor: ActorContext, body: CreateHolidayBody) {
    const existing = await Holiday.findOne({ date: body.date }).select('_id');
    if (existing) throw new AppError(409, 'HOLIDAY_EXISTS', 'A holiday already exists on this date');
    try {
      const holiday = await Holiday.create({ name: body.name, date: body.date, createdBy: actor.id });
      await recordAudit({
        actorId: actor.id,
        action: 'HOLIDAY_CREATED',
        entityType: 'holiday',
        entityId: String(holiday._id),
        after: { name: holiday.name, date: holiday.date },
        ip: actor.ip,
        userAgent: actor.userAgent,
      });
      return mapHoliday(holiday);
    } catch (error) {
      if (isDuplicateKeyError(error)) throw new AppError(409, 'HOLIDAY_EXISTS', 'A holiday already exists on this date');
      throw error;
    }
  },

  async update(actor: ActorContext, id: string, body: UpdateHolidayBody) {
    const holiday = await Holiday.findById(id);
    if (!holiday) throw new AppError(404, 'NOT_FOUND', 'Holiday not found');
    if (body.date && body.date !== holiday.date) {
      const existing = await Holiday.findOne({ date: body.date, _id: { $ne: holiday._id } }).select('_id');
      if (existing) throw new AppError(409, 'HOLIDAY_EXISTS', 'A holiday already exists on this date');
    }
    const before = { name: holiday.name, date: holiday.date };
    if (body.name) holiday.name = body.name;
    if (body.date) holiday.date = body.date;
    try {
      await holiday.save();
    } catch (error) {
      if (isDuplicateKeyError(error)) throw new AppError(409, 'HOLIDAY_EXISTS', 'A holiday already exists on this date');
      throw error;
    }
    await recordAudit({
      actorId: actor.id,
      action: 'HOLIDAY_UPDATED',
      entityType: 'holiday',
      entityId: id,
      before,
      after: { name: holiday.name, date: holiday.date },
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
    return mapHoliday(holiday);
  },

  async remove(actor: ActorContext, id: string) {
    const holiday = await Holiday.findById(id);
    if (!holiday) throw new AppError(404, 'NOT_FOUND', 'Holiday not found');
    await holiday.deleteOne();
    await recordAudit({
      actorId: actor.id,
      action: 'HOLIDAY_DELETED',
      entityType: 'holiday',
      entityId: id,
      before: { name: holiday.name, date: holiday.date },
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
    return { id, deleted: true };
  },
};
