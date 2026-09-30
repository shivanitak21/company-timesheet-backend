import { z } from 'zod';
import { EMPLOYMENT_TYPES, ROLES } from '../types/enums';
import { dateSchema, objectIdSchema, paginationQuerySchema, passwordSchema, requestSchema } from './common';

export const listUsersSchema = requestSchema(
  z.object({}).strip(),
  paginationQuerySchema.extend({
    search: z.string().trim().max(80).optional(),
    role: z.enum(ROLES).optional(),
    isActive: z.enum(['true', 'false']).optional(),
  }),
  z.object({}),
);

export const createUserSchema = requestSchema(
  z
    .object({
      email: z.string().trim().toLowerCase().email(),
      password: passwordSchema,
      firstName: z.string().trim().min(1).max(80),
      lastName: z.string().trim().min(1).max(80),
      role: z.enum(ROLES),
      employeeCode: z.string().trim().min(2).max(20).optional(),
      department: z.string().trim().min(2).max(80).optional(),
      designation: z.string().trim().min(2).max(80).optional(),
      joiningDate: dateSchema.optional(),
      employmentType: z.enum(EMPLOYMENT_TYPES).optional(),
      weeklyHours: z.number().int().min(1).max(80).optional(),
      phone: z.string().trim().max(30).optional(),
      managerId: objectIdSchema.optional(),
    })
    .strict(),
  z.object({}),
  z.object({}),
);

export const userIdSchema = requestSchema(z.object({}).strip(), z.object({}), z.object({ id: objectIdSchema }));

export const updateUserSchema = requestSchema(
  z
    .object({
      email: z.string().trim().toLowerCase().email().optional(),
      firstName: z.string().trim().min(1).max(80).optional(),
      lastName: z.string().trim().min(1).max(80).optional(),
      role: z.enum(ROLES).optional(),
      isActive: z.boolean().optional(),
    })
    .strict()
    .refine((value) => Object.keys(value).length > 0, 'No fields to update'),
  z.object({}),
  z.object({ id: objectIdSchema }),
);

export const resetPasswordSchema = requestSchema(
  z.object({ password: passwordSchema }).strict(),
  z.object({}),
  z.object({ id: objectIdSchema }),
);

export type CreateUserBody = z.infer<typeof createUserSchema>['body'];
export type UpdateUserBody = z.infer<typeof updateUserSchema>['body'];
export type ListUsersQuery = z.infer<typeof listUsersSchema>['query'];
