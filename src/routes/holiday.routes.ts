import { Router } from 'express';
import * as holidays from '../controllers/holiday.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { createHolidaySchema, holidayIdSchema, listHolidaysSchema, updateHolidaySchema } from '../validators/holiday.validator';

export const holidayRouter = Router();

holidayRouter.use(authenticate);
holidayRouter.get('/', validate(listHolidaysSchema), holidays.listHolidays);
holidayRouter.post('/', authorize('admin'), validate(createHolidaySchema), holidays.createHoliday);
holidayRouter.patch('/:id', authorize('admin'), validate(updateHolidaySchema), holidays.updateHoliday);
holidayRouter.delete('/:id', authorize('admin'), validate(holidayIdSchema), holidays.deleteHoliday);
