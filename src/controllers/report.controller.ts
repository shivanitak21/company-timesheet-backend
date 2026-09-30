import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/http';
import { actorOf, inputOf } from '../utils/request';
import { reportService } from '../services/report.service';

export const attendanceReport = asyncHandler(async (req, res) => {
  const { query } = inputOf<{ query: { from: string; to: string; userId?: string; page: number; limit: number } }>(req);
  const result = await reportService.attendance(actorOf(req), query);
  sendSuccess(res, { from: result.from, to: result.to, rows: result.rows }, 200, result.meta);
});

export const timesheetReport = asyncHandler(async (req, res) => {
  const { query } = inputOf<{ query: { year: number; month: number; userId?: string; page: number; limit: number } }>(req);
  const result = await reportService.timesheets(actorOf(req), query);
  sendSuccess(res, { year: result.year, month: result.month, rows: result.rows }, 200, result.meta);
});

export const leaveReport = asyncHandler(async (req, res) => {
  const { query } = inputOf<{ query: { year: number; userId?: string; page: number; limit: number } }>(req);
  const result = await reportService.leaves(actorOf(req), query);
  sendSuccess(res, { year: result.year, rows: result.rows }, 200, result.meta);
});

export const auditReport = asyncHandler(async (req, res) => {
  const { query } = inputOf<{ query: { page: number; limit: number; entityType?: string; actorId?: string } }>(req);
  const result = await reportService.audit(query);
  sendSuccess(res, result.rows, 200, result.meta);
});
