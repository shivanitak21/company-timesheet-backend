import { Router } from 'express';
import * as employees from '../controllers/employee.controller';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { employeeIdSchema, listEmployeesSchema, updateEmployeeSchema } from '../validators/employee.validator';

export const employeeRouter = Router();

employeeRouter.use(authenticate);
employeeRouter.get('/', validate(listEmployeesSchema), employees.listEmployees);
employeeRouter.get('/me', employees.myEmployee);
employeeRouter.get('/:id', validate(employeeIdSchema), employees.getEmployee);
employeeRouter.patch('/:id', validate(updateEmployeeSchema), employees.updateEmployee);
