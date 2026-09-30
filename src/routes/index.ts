import { Router } from 'express';
import { health } from '../controllers/health.controller';
import { attendanceRouter } from './attendance.routes';
import { authRouter } from './auth.routes';
import { employeeRouter } from './employee.routes';
import { holidayRouter } from './holiday.routes';
import { leaveRouter } from './leave.routes';
import { notificationRouter } from './notification.routes';
import { projectRouter } from './project.routes';
import { reportRouter } from './report.routes';
import { taskRouter } from './task.routes';
import { timesheetRouter } from './timesheet.routes';
import { userRouter } from './user.routes';

export const apiRouter = Router();

apiRouter.get('/health', health);
apiRouter.use('/auth', authRouter);
apiRouter.use('/users', userRouter);
apiRouter.use('/employees', employeeRouter);
apiRouter.use('/attendance', attendanceRouter);
apiRouter.use('/timesheets', timesheetRouter);
apiRouter.use('/tasks', taskRouter);
apiRouter.use('/projects', projectRouter);
apiRouter.use('/leaves', leaveRouter);
apiRouter.use('/holidays', holidayRouter);
apiRouter.use('/notifications', notificationRouter);
apiRouter.use('/reports', reportRouter);
