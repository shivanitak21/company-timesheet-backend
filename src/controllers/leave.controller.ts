import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/http';
import { actorOf, inputOf } from '../utils/request';
import { leaveService } from '../services/leave.service';
import type { ApprovedLeavesQuery, CreateLeaveBody, ListLeavesQuery } from '../validators/leave.validator';

export const createLeave = asyncHandler(async (req, res) => {
  const { body } = inputOf<{ body: CreateLeaveBody }>(req);
  sendSuccess(res, await leaveService.create(actorOf(req), body), 201);
});

export const listLeaves = asyncHandler(async (req, res) => {
  const { query } = inputOf<{ query: ListLeavesQuery }>(req);
  const result = await leaveService.list(actorOf(req), query);
  sendSuccess(res, result.rows, 200, result.meta);
});

export const approvedLeaves = asyncHandler(async (req, res) => {
  const { query } = inputOf<{ query: ApprovedLeavesQuery }>(req);
  const result = await leaveService.approved(actorOf(req), query);
  sendSuccess(res, result.rows, 200, result.meta);
});

export const pendingLeaves = asyncHandler(async (req, res) => {
  const { query } = inputOf<{ query: { page: number; limit: number } }>(req);
  const result = await leaveService.pending(actorOf(req), query.page, query.limit);
  sendSuccess(res, result.rows, 200, result.meta);
});

export const getLeave = asyncHandler(async (req, res) => {
  const { params } = inputOf<{ params: { id: string } }>(req);
  sendSuccess(res, await leaveService.get(actorOf(req), params.id));
});

export const approveLeave = asyncHandler(async (req, res) => {
  const { params } = inputOf<{ params: { id: string } }>(req);
  sendSuccess(res, await leaveService.approve(actorOf(req), params.id));
});

export const rejectLeave = asyncHandler(async (req, res) => {
  const { params, body } = inputOf<{ params: { id: string }; body: { reason: string } }>(req);
  sendSuccess(res, await leaveService.reject(actorOf(req), params.id, body.reason));
});

export const cancelLeave = asyncHandler(async (req, res) => {
  const { params } = inputOf<{ params: { id: string } }>(req);
  sendSuccess(res, await leaveService.cancel(actorOf(req), params.id));
});
