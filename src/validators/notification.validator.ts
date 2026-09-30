import { z } from 'zod';
import { objectIdSchema, paginationQuerySchema, requestSchema } from './common';

export const listNotificationsSchema = requestSchema(
  z.object({}).strip(),
  paginationQuerySchema.extend({
    unreadOnly: z.enum(['true', 'false']).optional(),
  }),
  z.object({}),
);

export const notificationIdSchema = requestSchema(
  z.object({}).strip(),
  z.object({}),
  z.object({ id: objectIdSchema }),
);

export type ListNotificationsQuery = z.infer<typeof listNotificationsSchema>['query'];
