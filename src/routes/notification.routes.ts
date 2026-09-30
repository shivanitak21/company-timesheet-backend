import { Router } from 'express';
import * as notifications from '../controllers/notification.controller';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { listNotificationsSchema, notificationIdSchema } from '../validators/notification.validator';
import { emptyBody, requestSchema } from '../validators/common';

const readAllSchema = requestSchema(emptyBody, emptyBody, emptyBody);

export const notificationRouter = Router();

notificationRouter.use(authenticate);
notificationRouter.get('/', validate(listNotificationsSchema), notifications.listNotifications);
notificationRouter.get('/unread-count', notifications.unreadCount);
notificationRouter.post('/read-all', validate(readAllSchema), notifications.markAllRead);
notificationRouter.patch('/:id/read', validate(notificationIdSchema), notifications.markRead);
