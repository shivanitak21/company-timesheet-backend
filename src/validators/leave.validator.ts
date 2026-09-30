import { z } from 'zod';
import { LEAVE_STATUSES, LEAVE_TYPES } from '../types/enums';
import { dateSchema, objectIdSchema, optionalQueryId, paginationQuerySchema, requestSchema } from './common';

export const createLeaveSchema = requestSchema(
  z.object({
    type: z.enum(LEAVE_TYPES),
    startDate: dateSchema,
    endDate: dateSchema,
    reason: z.string().trim().min(3).max(1000),
  }).strict().refine((value) => value.startDate <= value.endDate, 'End date must be on or after start date'),
  z.object({}),
  z.object({}),
);

export const listLeavesSchema = requestSchema(
  z.object({}).strip(),
  paginationQuerySchema.extend({
    status: z.enum(LEAVE_STATUSES).optional(),
    userId: optionalQueryId,
  }),
  z.object({}),
);

export const approvedLeavesSchema = requestSchema(
  z.object({}).strip(),
  paginationQuerySchema.extend({
    year: z.coerce.number().int().min(2000).max(2100).optional(),
    userId: optionalQueryId,
  }),
  z.object({}),
);

export const leaveIdSchema = requestSchema(z.object({}).strip(), z.object({}), z.object({ id: objectIdSchema }));

export const rejectLeaveSchema = requestSchema(
  z.object({ reason: z.string().trim().min(3).max(500) }).strict(),
  z.object({}),
  z.object({ id: objectIdSchema }),
);

export type CreateLeaveBody = z.infer<typeof createLeaveSchema>['body'];
export type ListLeavesQuery = z.infer<typeof listLeavesSchema>['query'];
export type ApprovedLeavesQuery = z.infer<typeof approvedLeavesSchema>['query'];
