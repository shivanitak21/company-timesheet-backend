import { Router } from 'express';
import * as timesheets from '../controllers/timesheet.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import {
  createEntrySchema,
  dailyQuerySchema,
  deleteEntrySchema,
  monthQuerySchema,
  pendingSchema,
  rejectTimesheetSchema,
  timesheetIdSchema,
  updateEntrySchema,
} from '../validators/timesheet.validator';

export const timesheetRouter = Router();

timesheetRouter.use(authenticate);
timesheetRouter.get('/calendar', validate(monthQuerySchema), timesheets.calendar);
timesheetRouter.get('/daily', validate(dailyQuerySchema), timesheets.daily);
timesheetRouter.get('/pending', authorize('manager', 'admin'), validate(pendingSchema), timesheets.pending);
timesheetRouter.post('/entries', validate(createEntrySchema), timesheets.createEntry);
timesheetRouter.patch('/entries/:entryId', validate(updateEntrySchema), timesheets.updateEntry);
timesheetRouter.delete('/entries/:entryId', validate(deleteEntrySchema), timesheets.deleteEntry);
timesheetRouter.get('/', validate(monthQuerySchema), timesheets.month);
timesheetRouter.get('/:id', validate(timesheetIdSchema), timesheets.getTimesheet);
timesheetRouter.post('/:id/submit', validate(timesheetIdSchema), timesheets.submitTimesheet);
timesheetRouter.post('/:id/approve', authorize('manager', 'admin'), validate(timesheetIdSchema), timesheets.approveTimesheet);
timesheetRouter.post('/:id/reject', authorize('manager', 'admin'), validate(rejectTimesheetSchema), timesheets.rejectTimesheet);
