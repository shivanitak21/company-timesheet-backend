import type { Request } from 'express';
import type { ActorContext } from '../types/actor';
import type { Platform } from '../types/enums';
import { AppError } from './AppError';

export function actorOf(req: Request): ActorContext {
  if (!req.actor) throw new AppError(401, 'MISSING_TOKEN', 'Access token is required');
  return req.actor;
}

export function inputOf<T>(req: Request): T {
  return req.validated as T;
}

export function platformOf(req: Request, explicit?: 'web' | 'mobile'): Platform {
  if (explicit) return explicit;
  const header = req.get('x-client-platform');
  if (header === 'web' || header === 'mobile') return header;
  return 'unknown';
}

export function clientMeta(req: Request) {
  return { ip: req.ip, userAgent: req.get('user-agent') || undefined };
}
