import { z } from 'zod';
import { dateSchema, objectIdSchema, requestSchema } from './common';

export const listHolidaysSchema = requestSchema(
  z.object({}).strip(),
  z.object({ year: z.coerce.number().int().min(2000).max(2100).optional() }),
  z.object({}),
);

export const createHolidaySchema = requestSchema(
  z.object({
    name: z.string().trim().min(2).max(120),
    date: dateSchema,
  }).strict(),
  z.object({}),
  z.object({}),
);

export const updateHolidaySchema = requestSchema(
  z.object({
    name: z.string().trim().min(2).max(120).optional(),
    date: dateSchema.optional(),
  }).strict().refine((value) => Object.keys(value).length > 0, 'No fields to update'),
  z.object({}),
  z.object({ id: objectIdSchema }),
);

export const holidayIdSchema = requestSchema(z.object({}).strip(), z.object({}), z.object({ id: objectIdSchema }));

export type CreateHolidayBody = z.infer<typeof createHolidaySchema>['body'];
export type UpdateHolidayBody = z.infer<typeof updateHolidaySchema>['body'];
