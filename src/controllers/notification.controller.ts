import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/http';
import { actorOf, inputOf } from '../utils/request';
import { notificationService } from '../services/notification.service';
import type { ListNotificationsQuery } from '../validators/notification.validator';

export const listNotifications = asyncHandler(async (req, res) => {
  const { query } = inputOf<{ query: ListNotificationsQuery }>(req);
  const result = await notificationService.list(actorOf(req), query);
  sendSuccess(res, result.rows, 200, result.meta);
});

export const unreadCount = asyncHandler(async (req, res) => {
  sendSuccess(res, await notificationService.unreadCount(actorOf(req)));
});

export const markRead = asyncHandler(async (req, res) => {
  const { params } = inputOf<{ params: { id: string } }>(req);
  sendSuccess(res, await notificationService.markRead(actorOf(req), params.id));
});

export const markAllRead = asyncHandler(async (req, res) => {
  sendSuccess(res, await notificationService.markAllRead(actorOf(req)));
});
