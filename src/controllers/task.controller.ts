import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/http';
import { actorOf, inputOf } from '../utils/request';
import { taskService } from '../services/task.service';
import type { CreateTaskBody, ListTasksQuery, UpdateTaskBody } from '../validators/task.validator';

export const assignedTasks = asyncHandler(async (req, res) => {
  const { query } = inputOf<{ query: ListTasksQuery }>(req);
  const result = await taskService.assigned(actorOf(req), query);
  sendSuccess(res, result.rows, 200, result.meta);
});

export const listTasks = asyncHandler(async (req, res) => {
  const { query } = inputOf<{ query: ListTasksQuery }>(req);
  const result = await taskService.list(actorOf(req), query);
  sendSuccess(res, result.rows, 200, result.meta);
});

export const createTask = asyncHandler(async (req, res) => {
  const { body } = inputOf<{ body: CreateTaskBody }>(req);
  sendSuccess(res, await taskService.create(actorOf(req), body), 201);
});

export const getTask = asyncHandler(async (req, res) => {
  const { params } = inputOf<{ params: { id: string } }>(req);
  sendSuccess(res, await taskService.get(actorOf(req), params.id));
});

export const updateTask = asyncHandler(async (req, res) => {
  const { params, body } = inputOf<{ params: { id: string }; body: UpdateTaskBody }>(req);
  sendSuccess(res, await taskService.update(actorOf(req), params.id, body));
});
