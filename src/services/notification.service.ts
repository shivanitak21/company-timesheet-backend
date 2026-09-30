import { EmployeeProfile } from '../models/EmployeeProfile';
import { Notification } from '../models/Notification';
import { User } from '../models/User';
import type { ActorContext } from '../types/actor';
import { AppError } from '../utils/AppError';
import { pageMeta } from '../utils/http';
import { logger } from '../utils/logger';
import type { ListNotificationsQuery } from '../validators/notification.validator';

type Notice = {
  type: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
};

export async function notify(userId: string, notice: Notice): Promise<void> {
  try {
    await Notification.create({
      user: userId,
      type: notice.type,
      title: notice.title,
      message: notice.message,
      metadata: notice.metadata,
    });
  } catch (error) {
    logger.error({ err: error, userId, type: notice.type }, 'notification failed');
  }
}

export async function notifyAdmins(notice: Notice, exceptUserId?: string): Promise<void> {
  const admins = await User.find({ role: 'admin', isActive: true }).select('_id');
  const ids = admins.map((admin) => String(admin._id)).filter((id) => id !== exceptUserId);
  await Promise.all(ids.map((id) => notify(id, notice)));
}

export async function notifyManagerOrAdmins(employeeUserId: string, notice: Notice, exceptUserId?: string): Promise<void> {
  const profile = await EmployeeProfile.findOne({ user: employeeUserId }).select('manager');
  if (profile?.manager) {
    const managerId = String(profile.manager);
    if (managerId !== exceptUserId) await notify(managerId, notice);
    return;
  }
  await notifyAdmins(notice, exceptUserId);
}

function mapNotification(row: {
  _id: unknown;
  type: string;
  title: string;
  message: string;
  readAt?: Date | null;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}) {
  return {
    id: String(row._id),
    type: row.type,
    title: row.title,
    message: row.message,
    readAt: row.readAt ?? null,
    metadata: row.metadata ?? null,
    createdAt: row.createdAt,
  };
}

export const notificationService = {
  async list(actor: ActorContext, query: ListNotificationsQuery) {
    const filter: Record<string, unknown> = { user: actor.id };
    if (query.unreadOnly === 'true') filter.readAt = null;
    const skip = (query.page - 1) * query.limit;
    const [rows, total, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(query.limit),
      Notification.countDocuments(filter),
      Notification.countDocuments({ user: actor.id, readAt: null }),
    ]);
    return {
      rows: rows.map((row) => mapNotification(row)),
      meta: { ...pageMeta(query.page, query.limit, total), unreadCount },
    };
  },

  async unreadCount(actor: ActorContext) {
    const unreadCount = await Notification.countDocuments({ user: actor.id, readAt: null });
    return { unreadCount };
  },

  async markRead(actor: ActorContext, id: string) {
    const row = await Notification.findOne({ _id: id, user: actor.id });
    if (!row) throw new AppError(404, 'NOT_FOUND', 'Notification not found');
    if (!row.readAt) {
      row.readAt = new Date();
      await row.save();
    }
    return mapNotification(row);
  },

  async markAllRead(actor: ActorContext) {
    const result = await Notification.updateMany({ user: actor.id, readAt: null }, { readAt: new Date() });
    return { updated: result.modifiedCount };
  },
};
