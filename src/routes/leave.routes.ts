import { Router } from 'express';
import * as leaves from '../controllers/leave.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { approvedLeavesSchema, createLeaveSchema, leaveIdSchema, listLeavesSchema, rejectLeaveSchema } from '../validators/leave.validator';
import { pendingSchema } from '../validators/timesheet.validator';

export const leaveRouter = Router();

leaveRouter.use(authenticate);
leaveRouter.post('/', validate(createLeaveSchema), leaves.createLeave);
leaveRouter.get('/', validate(listLeavesSchema), leaves.listLeaves);
leaveRouter.get('/approved', validate(approvedLeavesSchema), leaves.approvedLeaves);
leaveRouter.get('/pending', authorize('manager', 'admin'), validate(pendingSchema), leaves.pendingLeaves);
leaveRouter.get('/:id', validate(leaveIdSchema), leaves.getLeave);
leaveRouter.post('/:id/approve', authorize('manager', 'admin'), validate(leaveIdSchema), leaves.approveLeave);
leaveRouter.post('/:id/reject', authorize('manager', 'admin'), validate(rejectLeaveSchema), leaves.rejectLeave);
leaveRouter.post('/:id/cancel', validate(leaveIdSchema), leaves.cancelLeave);
