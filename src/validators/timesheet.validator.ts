import { z } from 'zod';
import { dateSchema, objectIdSchema, optionalQueryId, paginationQuerySchema, requestSchema, timeSchema } from './common';

const entryFields = {
  date: dateSchema,
  startTime: timeSchema,
  endTime: timeSchema,
  description: z.string().trim().min(1).max(1000),
};

const entryBody = z.discriminatedUnion('workType', [
  z.object({ workType: z.literal('assigned'), taskId: objectIdSchema, ...entryFields }).strict(),
  z.object({ workType: z.literal('unassigned'), projectId: objectIdSchema.optional(), ...entryFields }).strict(),
]);

export const monthQuerySchema = requestSchema(
  z.object({}).strip(),
  z.object({
    year: z.coerce.number().int().min(2000).max(2100),
    month: z.coerce.number().int().min(1).max(12),
    userId: optionalQueryId,
  }),
  z.object({}),
);

export const dailyQuerySchema = requestSchema(
  z.object({}).strip(),
  z.object({ date: dateSchema, userId: optionalQueryId }),
  z.object({}),
);

export const pendingSchema = requestSchema(z.object({}).strip(), paginationQuerySchema, z.object({}));

export const createEntrySchema = requestSchema(entryBody, z.object({}), z.object({}));

export const updateEntrySchema = requestSchema(entryBody, z.object({}), z.object({ entryId: objectIdSchema }));

export const deleteEntrySchema = requestSchema(z.object({}).strip(), z.object({}), z.object({ entryId: objectIdSchema }));

export const timesheetIdSchema = requestSchema(z.object({}).strip(), z.object({}), z.object({ id: objectIdSchema }));

export const rejectTimesheetSchema = requestSchema(
  z.object({ reason: z.string().trim().min(3).max(500) }).strict(),
  z.object({}),
  z.object({ id: objectIdSchema }),
);

export type MonthQuery = z.infer<typeof monthQuerySchema>['query'];
export type DailyQuery = z.infer<typeof dailyQuerySchema>['query'];
export type EntryBody = z.infer<typeof createEntrySchema>['body'];
