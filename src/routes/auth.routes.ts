import { Router } from 'express';
import * as auth from '../controllers/auth.controller';
import { authenticate } from '../middleware/authenticate';
import { authLimiter } from '../middleware/rateLimiter';
import { validate } from '../middleware/validate';
import { changePasswordSchema, loginSchema, refreshSchema } from '../validators/auth.validator';

export const authRouter = Router();

authRouter.post('/login', authLimiter, validate(loginSchema), auth.login);
authRouter.post('/refresh', authLimiter, validate(refreshSchema), auth.refresh);
authRouter.post('/logout', authLimiter, validate(refreshSchema), auth.logout);
authRouter.post('/logout-all', authenticate, auth.logoutAll);
authRouter.get('/me', authenticate, auth.me);
authRouter.post('/change-password', authenticate, validate(changePasswordSchema), auth.changePassword);
