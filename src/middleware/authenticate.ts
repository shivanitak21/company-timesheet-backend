import type { RequestHandler } from 'express';
import { AppError } from '../utils/AppError';
import { authService } from '../services/auth.service';

export const authenticate: RequestHandler = async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next(new AppError(401, 'MISSING_TOKEN', 'Access token is required'));
    return;
  }
  const token = header.slice('Bearer '.length).trim();
  if (!token) {
    next(new AppError(401, 'MISSING_TOKEN', 'Access token is required'));
    return;
  }
  try {
    const actor = await authService.authenticateAccessToken(token);
    req.actor = {
      ...actor,
      ip: req.ip,
      userAgent: req.get('user-agent') || undefined,
    };
    next();
  } catch (error) {
    next(error);
  }
};
