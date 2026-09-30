import { Router } from 'express';
import * as reports from '../controllers/report.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { attendanceReportSchema, auditReportSchema, leaveReportSchema, timesheetReportSchema } from '../validators/report.validator';

export const reportRouter = Router();

reportRouter.use(authenticate);
reportRouter.get('/attendance', validate(attendanceReportSchema), reports.attendanceReport);
reportRouter.get('/timesheets', validate(timesheetReportSchema), reports.timesheetReport);
reportRouter.get('/leaves', validate(leaveReportSchema), reports.leaveReport);
reportRouter.get('/audit', authorize('admin'), validate(auditReportSchema), reports.auditReport);
