import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';

function sendLimited(message: string) {
  return (req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message,
        details: null,
        requestId: req.id == null ? '' : String(req.id),
      },
    });
  };
}

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: sendLimited('Too many requests'),
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: sendLimited('Too many authentication attempts'),
});
