import { z } from 'zod';
import { dateSchema, objectIdSchema, optionalQueryId, requestSchema } from './common';

const notes = z.string().trim().max(300).optional();
const platform = z.enum(['web', 'mobile']).optional();

export const checkInSchema = requestSchema(
  z.object({ notes, platform }).strict(),
  z.object({}),
  z.object({}),
);

export const historySchema = requestSchema(
  z.object({}).strip(),
  z.object({
    from: dateSchema.optional(),
    to: dateSchema.optional(),
    userId: optionalQueryId,
  }),
  z.object({}),
);

export const correctAttendanceSchema = requestSchema(
  z.object({
    checkInAt: z.string().datetime().optional(),
    checkOutAt: z.string().datetime().optional(),
    notes: z.string().trim().max(300).nullable().optional(),
  }).strict().refine((value) => Object.keys(value).length > 0, 'No fields to update'),
  z.object({}),
  z.object({ id: objectIdSchema }),
);

export type CheckInBody = z.infer<typeof checkInSchema>['body'];
export type HistoryQuery = z.infer<typeof historySchema>['query'];
export type CorrectAttendanceBody = z.infer<typeof correctAttendanceSchema>['body'];
