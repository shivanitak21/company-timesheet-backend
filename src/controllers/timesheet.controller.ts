import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/http';
import { actorOf, inputOf } from '../utils/request';
import { getMonthCalendar } from '../services/calendar.service';
import { timesheetService } from '../services/timesheet.service';
import type { DailyQuery, EntryBody, MonthQuery } from '../validators/timesheet.validator';

export const calendar = asyncHandler(async (req, res) => {
  const { query } = inputOf<{ query: MonthQuery }>(req);
  sendSuccess(res, await getMonthCalendar(actorOf(req), query.year, query.month, query.userId));
});

export const daily = asyncHandler(async (req, res) => {
  const { query } = inputOf<{ query: DailyQuery }>(req);
  sendSuccess(res, await timesheetService.getDaily(actorOf(req), query.date, query.userId));
});

export const month = asyncHandler(async (req, res) => {
  const { query } = inputOf<{ query: MonthQuery }>(req);
  sendSuccess(res, await timesheetService.getMonth(actorOf(req), query));
});

export const pending = asyncHandler(async (req, res) => {
  const { query } = inputOf<{ query: { page: number; limit: number } }>(req);
  const result = await timesheetService.listPending(actorOf(req), query.page, query.limit);
  sendSuccess(res, result.rows, 200, result.meta);
});

export const getTimesheet = asyncHandler(async (req, res) => {
  const { params } = inputOf<{ params: { id: string } }>(req);
  sendSuccess(res, await timesheetService.getById(actorOf(req), params.id));
});

export const createEntry = asyncHandler(async (req, res) => {
  const { body } = inputOf<{ body: EntryBody }>(req);
  sendSuccess(res, await timesheetService.createEntry(actorOf(req), body), 201);
});

export const updateEntry = asyncHandler(async (req, res) => {
  const { params, body } = inputOf<{ params: { entryId: string }; body: EntryBody }>(req);
  sendSuccess(res, await timesheetService.updateEntry(actorOf(req), params.entryId, body));
});

export const deleteEntry = asyncHandler(async (req, res) => {
  const { params } = inputOf<{ params: { entryId: string } }>(req);
  sendSuccess(res, await timesheetService.deleteEntry(actorOf(req), params.entryId));
});

export const submitTimesheet = asyncHandler(async (req, res) => {
  const { params } = inputOf<{ params: { id: string } }>(req);
  sendSuccess(res, await timesheetService.submit(actorOf(req), params.id));
});

export const approveTimesheet = asyncHandler(async (req, res) => {
  const { params } = inputOf<{ params: { id: string } }>(req);
  sendSuccess(res, await timesheetService.approve(actorOf(req), params.id));
});

export const rejectTimesheet = asyncHandler(async (req, res) => {
  const { params, body } = inputOf<{ params: { id: string }; body: { reason: string } }>(req);
  sendSuccess(res, await timesheetService.reject(actorOf(req), params.id, body.reason));
});
