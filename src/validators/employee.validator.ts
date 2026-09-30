import { z } from 'zod';
import { EMPLOYMENT_TYPES } from '../types/enums';
import { dateSchema, objectIdSchema, optionalQueryId, paginationQuerySchema, requestSchema } from './common';

export const listEmployeesSchema = requestSchema(
  z.object({}).strip(),
  paginationQuerySchema.extend({
    search: z.string().trim().max(80).optional(),
    department: z.string().trim().max(80).optional(),
    managerId: optionalQueryId,
  }),
  z.object({}),
);

export const employeeIdSchema = requestSchema(z.object({}).strip(), z.object({}), z.object({ id: objectIdSchema }));

export const updateEmployeeSchema = requestSchema(
  z.object({
    phone: z.string().trim().max(30).optional(),
    department: z.string().trim().min(2).max(80).optional(),
    designation: z.string().trim().min(2).max(80).optional(),
    managerId: objectIdSchema.nullable().optional(),
    employeeCode: z.string().trim().min(2).max(20).optional(),
    joiningDate: dateSchema.optional(),
    employmentType: z.enum(EMPLOYMENT_TYPES).optional(),
    weeklyHours: z.number().int().min(1).max(80).optional(),
  }).strict().refine((value) => Object.keys(value).length > 0, 'No fields to update'),
  z.object({}),
  z.object({ id: objectIdSchema }),
);

export type ListEmployeesQuery = z.infer<typeof listEmployeesSchema>['query'];
export type UpdateEmployeeBody = z.infer<typeof updateEmployeeSchema>['body'];
