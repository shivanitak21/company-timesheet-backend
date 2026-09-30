import { Router } from 'express';
import * as projects from '../controllers/project.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { createProjectSchema, listProjectsSchema, projectIdSchema, updateProjectSchema } from '../validators/project.validator';

export const projectRouter = Router();

projectRouter.use(authenticate);
projectRouter.get('/', validate(listProjectsSchema), projects.listProjects);
projectRouter.post('/', authorize('manager', 'admin'), validate(createProjectSchema), projects.createProject);
projectRouter.get('/:id', validate(projectIdSchema), projects.getProject);
projectRouter.patch('/:id', validate(updateProjectSchema), projects.updateProject);
