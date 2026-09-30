import { Router } from 'express';
import * as users from '../controllers/user.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { createUserSchema, listUsersSchema, resetPasswordSchema, updateUserSchema, userIdSchema } from '../validators/user.validator';

export const userRouter = Router();

userRouter.use(authenticate);
userRouter.get('/', authorize('admin'), validate(listUsersSchema), users.listUsers);
userRouter.post('/', authorize('admin'), validate(createUserSchema), users.createUser);
userRouter.get('/:id', validate(userIdSchema), users.getUser);
userRouter.patch('/:id', validate(updateUserSchema), users.updateUser);
userRouter.post('/:id/reset-password', authorize('admin'), validate(resetPasswordSchema), users.resetPassword);
