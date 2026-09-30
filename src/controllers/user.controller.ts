import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/http';
import { actorOf, inputOf } from '../utils/request';
import { userService } from '../services/user.service';
import type { CreateUserBody, ListUsersQuery, UpdateUserBody } from '../validators/user.validator';

export const listUsers = asyncHandler(async (req, res) => {
  const { query } = inputOf<{ query: ListUsersQuery }>(req);
  const result = await userService.list(query);
  sendSuccess(res, result.rows, 200, result.meta);
});

export const createUser = asyncHandler(async (req, res) => {
  const { body } = inputOf<{ body: CreateUserBody }>(req);
  sendSuccess(res, await userService.create(actorOf(req), body), 201);
});

export const getUser = asyncHandler(async (req, res) => {
  const { params } = inputOf<{ params: { id: string } }>(req);
  sendSuccess(res, await userService.get(actorOf(req), params.id));
});

export const updateUser = asyncHandler(async (req, res) => {
  const { params, body } = inputOf<{ params: { id: string }; body: UpdateUserBody }>(req);
  sendSuccess(res, await userService.update(actorOf(req), params.id, body));
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { params, body } = inputOf<{ params: { id: string }; body: { password: string } }>(req);
  sendSuccess(res, await userService.resetPassword(actorOf(req), params.id, body.password));
});
