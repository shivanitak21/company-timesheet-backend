import type { Response } from 'express';
import type { PageMeta } from '../types/actor';

export function sendSuccess<T>(res: Response, data: T, statusCode = 200, meta?: PageMeta | Record<string, unknown>) {
  res.status(statusCode).json({
    success: true,
    data,
    ...(meta ? { meta } : {}),
  });
}

export function pageMeta(page: number, limit: number, total: number): PageMeta {
  return {
    page,
    limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}
