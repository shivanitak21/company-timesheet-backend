import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/http';
import { actorOf, inputOf, platformOf } from '../utils/request';
import { attendanceService } from '../services/attendance.service';
import type { CheckInBody, CorrectAttendanceBody, HistoryQuery } from '../validators/attendance.validator';

export const checkIn = asyncHandler(async (req, res) => {
  const { body } = inputOf<{ body: CheckInBody }>(req);
  const data = await attendanceService.checkIn(actorOf(req), { notes: body.notes, platform: platformOf(req, body.platform) });
  sendSuccess(res, data, 201);
});

export const checkOut = asyncHandler(async (req, res) => {
  const { body } = inputOf<{ body: CheckInBody }>(req);
  const data = await attendanceService.checkOut(actorOf(req), { notes: body.notes, platform: platformOf(req, body.platform) });
  sendSuccess(res, data);
});

export const today = asyncHandler(async (req, res) => {
  sendSuccess(res, await attendanceService.today(actorOf(req)));
});

export const history = asyncHandler(async (req, res) => {
  const { query } = inputOf<{ query: HistoryQuery }>(req);
  sendSuccess(res, await attendanceService.history(actorOf(req), query));
});

export const correct = asyncHandler(async (req, res) => {
  const { params, body } = inputOf<{ params: { id: string }; body: CorrectAttendanceBody }>(req);
  sendSuccess(res, await attendanceService.correct(actorOf(req), params.id, body));
});
