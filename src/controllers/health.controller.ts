import mongoose from 'mongoose';
import { APP_NAME } from '../config/constants';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/http';

export const health = asyncHandler(async (_req, res) => {
  sendSuccess(res, { status: 'ok', service: APP_NAME });
});

export const ready = asyncHandler(async (_req, res) => {
  if (mongoose.connection.readyState !== 1) {
    throw new AppError(503, 'NOT_READY', 'Database is not connected');
  }
  sendSuccess(res, { status: 'ready' });
});
