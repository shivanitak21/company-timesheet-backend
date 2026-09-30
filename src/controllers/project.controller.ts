import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/http';
import { actorOf, inputOf } from '../utils/request';
import { projectService } from '../services/project.service';
import type { CreateProjectBody, ListProjectsQuery, UpdateProjectBody } from '../validators/project.validator';

export const listProjects = asyncHandler(async (req, res) => {
  const { query } = inputOf<{ query: ListProjectsQuery }>(req);
  const result = await projectService.list(actorOf(req), query);
  sendSuccess(res, result.rows, 200, result.meta);
});

export const createProject = asyncHandler(async (req, res) => {
  const { body } = inputOf<{ body: CreateProjectBody }>(req);
  sendSuccess(res, await projectService.create(actorOf(req), body), 201);
});

export const getProject = asyncHandler(async (req, res) => {
  const { params } = inputOf<{ params: { id: string } }>(req);
  sendSuccess(res, await projectService.get(actorOf(req), params.id));
});

export const updateProject = asyncHandler(async (req, res) => {
  const { params, body } = inputOf<{ params: { id: string }; body: UpdateProjectBody }>(req);
  sendSuccess(res, await projectService.update(actorOf(req), params.id, body));
});
