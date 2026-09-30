import { Router } from 'express';
import * as attendance from '../controllers/attendance.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { checkInSchema, correctAttendanceSchema, historySchema } from '../validators/attendance.validator';

export const attendanceRouter = Router();

attendanceRouter.use(authenticate);
attendanceRouter.post('/check-in', validate(checkInSchema), attendance.checkIn);
attendanceRouter.post('/check-out', validate(checkInSchema), attendance.checkOut);
attendanceRouter.get('/today', attendance.today);
attendanceRouter.get('/history', validate(historySchema), attendance.history);
attendanceRouter.patch('/:id', authorize('manager', 'admin'), validate(correctAttendanceSchema), attendance.correct);
