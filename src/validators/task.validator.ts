import { z } from 'zod';
import { PRIORITIES, TASK_STATUSES } from '../types/enums';
import { dateSchema, objectIdSchema, paginationQuerySchema, requestSchema } from './common';

export const listTasksSchema = requestSchema(
  z.object({}).strip(),
  paginationQuerySchema.extend({ status: z.enum(TASK_STATUSES).optional() }),
  z.object({}),
);

export const createTaskSchema = requestSchema(
  z.object({
    projectId: objectIdSchema,
    title: z.string().trim().min(2).max(160),
    description: z.string().trim().max(5000).optional().default(''),
    assignedTo: objectIdSchema,
    priority: z.enum(PRIORITIES).default('medium'),
    dueDate: dateSchema.optional(),
    estimatedMinutes: z.number().int().min(1).max(100_000).optional(),
  }).strict(),
  z.object({}),
  z.object({}),
);

export const updateTaskSchema = requestSchema(
  z.object({
    title: z.string().trim().min(2).max(160).optional(),
    description: z.string().trim().max(5000).optional(),
    assignedTo: objectIdSchema.optional(),
    priority: z.enum(PRIORITIES).optional(),
    dueDate: dateSchema.nullable().optional(),
    estimatedMinutes: z.number().int().min(1).max(100_000).nullable().optional(),
    status: z.enum(TASK_STATUSES).optional(),
    projectId: objectIdSchema.optional(),
  }).strict().refine((value) => Object.keys(value).length > 0, 'No fields to update'),
  z.object({}),
  z.object({ id: objectIdSchema }),
);

export const taskIdSchema = requestSchema(z.object({}).strip(), z.object({}), z.object({ id: objectIdSchema }));

export type CreateTaskBody = z.infer<typeof createTaskSchema>['body'];
export type UpdateTaskBody = z.infer<typeof updateTaskSchema>['body'];
export type ListTasksQuery = z.infer<typeof listTasksSchema>['query'];
