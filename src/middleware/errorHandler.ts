import type { ErrorRequestHandler } from 'express';
import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';
import { isDuplicateKeyError } from '../utils/mongo';

function requestId(req: { id?: unknown }): string {
  return req.id == null ? '' : String(req.id);
}

function duplicateMessage(keyPattern?: Record<string, number>): { code: string; message: string } {
  if (keyPattern?.email) return { code: 'EMAIL_EXISTS', message: 'Email already exists' };
  if (keyPattern?.employeeCode) return { code: 'EMPLOYEE_CODE_EXISTS', message: 'Employee code already exists' };
  if (keyPattern?.date && keyPattern.user) return { code: 'ALREADY_CHECKED_IN', message: 'Attendance already exists for this date' };
  if (keyPattern?.date) return { code: 'HOLIDAY_EXISTS', message: 'A holiday already exists on this date' };
  if (keyPattern?.code) return { code: 'PROJECT_CODE_EXISTS', message: 'Project code already exists' };
  if (keyPattern?.user && keyPattern.year) return { code: 'TIMESHEET_EXISTS', message: 'Timesheet already exists for this month' };
  return { code: 'CONFLICT', message: 'Duplicate value' };
}

export const errorHandler: ErrorRequestHandler = (err: unknown, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  const id = requestId(req);

  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ err, requestId: id }, err.message);
    }
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details ?? null,
        requestId: id,
      },
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(422).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: err.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
        requestId: id,
      },
    });
    return;
  }

  if (isDuplicateKeyError(err)) {
    const mapped = duplicateMessage(err.keyPattern);
    res.status(409).json({
      success: false,
      error: { code: mapped.code, message: mapped.message, details: null, requestId: id },
    });
    return;
  }

  if (err instanceof mongoose.Error.CastError) {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_ID', message: 'Invalid id', details: null, requestId: id },
    });
    return;
  }

  if (err instanceof mongoose.Error.ValidationError) {
    res.status(422).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: Object.values(err.errors).map((item) => ({ path: item.path, message: item.message })),
        requestId: id,
      },
    });
    return;
  }

  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON', details: null, requestId: id },
    });
    return;
  }

  logger.error({ err, requestId: id }, 'unhandled error');
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong',
      details: env.NODE_ENV === 'development' && err instanceof Error ? err.message : null,
      requestId: id,
    },
  });
};
