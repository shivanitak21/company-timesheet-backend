import type { RequestHandler } from 'express';
import type { Role } from '../types/enums';
import { AppError } from '../utils/AppError';

export function authorize(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.actor || !roles.includes(req.actor.role)) {
      next(new AppError(403, 'FORBIDDEN', 'You do not have permission to perform this action'));
      return;
    }
    next();
  };
}
