import { Router } from 'express';
import * as tasks from '../controllers/task.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { createTaskSchema, listTasksSchema, taskIdSchema, updateTaskSchema } from '../validators/task.validator';

export const taskRouter = Router();

taskRouter.use(authenticate);
taskRouter.get('/assigned', validate(listTasksSchema), tasks.assignedTasks);
taskRouter.get('/', validate(listTasksSchema), tasks.listTasks);
taskRouter.post('/', authorize('manager', 'admin'), validate(createTaskSchema), tasks.createTask);
taskRouter.get('/:id', validate(taskIdSchema), tasks.getTask);
taskRouter.patch('/:id', validate(updateTaskSchema), tasks.updateTask);
