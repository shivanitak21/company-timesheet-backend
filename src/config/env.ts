import dotenv from 'dotenv';
import { z } from 'zod';
import { ROLES, type Role } from '../types/enums';

dotenv.config();

const secretSchema = z
  .string()
  .min(32, 'Must be at least 32 characters')
  .refine((value) => !value.toLowerCase().includes('replace-with'), 'Replace the placeholder secret');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  MONGODB_URI: z
    .string()
    .min(1)
    .refine(
      (value) => value.startsWith('mongodb://') || value.startsWith('mongodb+srv://'),
      'Must be a MongoDB connection string',
    ),
  JWT_ACCESS_SECRET: secretSchema,
  JWT_REFRESH_SECRET: secretSchema,
  JWT_ACCESS_EXPIRES_IN: z.string().min(1).default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().min(1).default('7d'),
  CLIENT_WEB_URL: z.string().url(),
  CLIENT_MOBILE_URL: z.union([z.literal(''), z.string().url()]).optional().default(''),
  COMPANY_TIMEZONE: z.string().min(1).default('Asia/Kolkata'),
  TIMESHEET_ENTRY_WINDOW_OVERRIDE_ROLES: z.string().optional().default(''),
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
  TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, '');
}

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const message = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('\n');
    console.error(`Invalid environment configuration:\n${message}`);
    process.exit(1);
  }

  try {
    Intl.DateTimeFormat('en-US', { timeZone: parsed.data.COMPANY_TIMEZONE }).format(new Date());
  } catch {
    console.error(`Invalid environment configuration:\nCOMPANY_TIMEZONE: Unknown timezone ${parsed.data.COMPANY_TIMEZONE}`);
    process.exit(1);
  }

  const webOrigin = stripTrailingSlash(parsed.data.CLIENT_WEB_URL);
  const mobileOrigin = parsed.data.CLIENT_MOBILE_URL ? stripTrailingSlash(parsed.data.CLIENT_MOBILE_URL) : '';
  const corsOrigins = [webOrigin, mobileOrigin].filter((origin) => origin.length > 0);
  const entryWindowOverrideRoles = parsed.data.TIMESHEET_ENTRY_WINDOW_OVERRIDE_ROLES.split(',')
    .map((role) => role.trim())
    .filter((role): role is Role => ROLES.includes(role as Role));

  return {
    ...parsed.data,
    CLIENT_WEB_URL: webOrigin,
    CLIENT_MOBILE_URL: mobileOrigin,
    corsOrigins,
    entryWindowOverrideRoles,
  };
}

export const env = loadEnv();
