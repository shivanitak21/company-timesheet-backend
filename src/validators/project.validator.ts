import { z } from 'zod';
import { PROJECT_STATUSES } from '../types/enums';
import { dateSchema, objectIdSchema, paginationQuerySchema, requestSchema } from './common';

const codeSchema = z.string().trim().min(2).max(20).regex(/^[A-Za-z0-9_-]+$/, 'Code may contain letters, numbers, _ and -').transform((value) => value.toUpperCase());

export const listProjectsSchema = requestSchema(
  z.object({}).strip(),
  paginationQuerySchema.extend({
    status: z.enum(PROJECT_STATUSES).optional(),
    search: z.string().trim().max(80).optional(),
  }),
  z.object({}),
);

export const createProjectSchema = requestSchema(
  z.object({
    name: z.string().trim().min(2).max(120),
    code: codeSchema,
    description: z.string().trim().max(2000).optional().default(''),
    managerId: objectIdSchema,
    memberIds: z.array(objectIdSchema).max(200).optional().default([]),
    startDate: dateSchema.optional(),
    endDate: dateSchema.nullable().optional(),
    status: z.enum(PROJECT_STATUSES).default('active'),
  }).strict(),
  z.object({}),
  z.object({}),
);

export const updateProjectSchema = requestSchema(
  z.object({
    name: z.string().trim().min(2).max(120).optional(),
    description: z.string().trim().max(2000).optional(),
    managerId: objectIdSchema.optional(),
    memberIds: z.array(objectIdSchema).max(200).optional(),
    startDate: dateSchema.nullable().optional(),
    endDate: dateSchema.nullable().optional(),
    status: z.enum(PROJECT_STATUSES).optional(),
  }).strict().refine((value) => Object.keys(value).length > 0, 'No fields to update'),
  z.object({}),
  z.object({ id: objectIdSchema }),
);

export const projectIdSchema = requestSchema(z.object({}).strip(), z.object({}), z.object({ id: objectIdSchema }));

export type CreateProjectBody = z.infer<typeof createProjectSchema>['body'];
export type UpdateProjectBody = z.infer<typeof updateProjectSchema>['body'];
export type ListProjectsQuery = z.infer<typeof listProjectsSchema>['query'];
