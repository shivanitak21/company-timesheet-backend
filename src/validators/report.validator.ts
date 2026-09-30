import { z } from 'zod';
import { dateSchema, objectIdSchema, optionalQueryId, paginationQuerySchema, requestSchema } from './common';

export const attendanceReportSchema = requestSchema(
  z.object({}).strip(),
  paginationQuerySchema.extend({
    from: dateSchema,
    to: dateSchema,
    userId: optionalQueryId,
  }),
  z.object({}),
);

export const timesheetReportSchema = requestSchema(
  z.object({}).strip(),
  paginationQuerySchema.extend({
    year: z.coerce.number().int().min(2000).max(2100),
    month: z.coerce.number().int().min(1).max(12),
    userId: optionalQueryId,
  }),
  z.object({}),
);

export const leaveReportSchema = requestSchema(
  z.object({}).strip(),
  paginationQuerySchema.extend({
    year: z.coerce.number().int().min(2000).max(2100),
    userId: optionalQueryId,
  }),
  z.object({}),
);

export const auditReportSchema = requestSchema(
  z.object({}).strip(),
  paginationQuerySchema.extend({
    entityType: z.string().trim().max(50).optional(),
    actorId: optionalQueryId,
  }),
  z.object({}),
);

export { objectIdSchema };
