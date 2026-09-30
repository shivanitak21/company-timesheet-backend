import { z } from 'zod';
import { passwordSchema, requestSchema } from './common';

export const loginSchema = requestSchema(
  z.object({
    email: z.string().trim().toLowerCase().email(),
    password: z.string().min(1).max(72),
  }).strict(),
  z.object({}),
  z.object({}),
);

export const refreshSchema = requestSchema(
  z.object({ refreshToken: z.string().min(1) }).strict(),
  z.object({}),
  z.object({}),
);

export const changePasswordSchema = requestSchema(
  z.object({
    currentPassword: z.string().min(1).max(72),
    newPassword: passwordSchema,
  }).strict(),
  z.object({}),
  z.object({}),
);

export type LoginBody = z.infer<typeof loginSchema>['body'];
export type RefreshBody = z.infer<typeof refreshSchema>['body'];
export type ChangePasswordBody = z.infer<typeof changePasswordSchema>['body'];
