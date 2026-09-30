import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/http';
import { actorOf, inputOf } from '../utils/request';
import { holidayService } from '../services/holiday.service';
import type { CreateHolidayBody, UpdateHolidayBody } from '../validators/holiday.validator';

export const listHolidays = asyncHandler(async (req, res) => {
  const { query } = inputOf<{ query: { year?: number } }>(req);
  sendSuccess(res, await holidayService.list(query.year));
});

export const createHoliday = asyncHandler(async (req, res) => {
  const { body } = inputOf<{ body: CreateHolidayBody }>(req);
  sendSuccess(res, await holidayService.create(actorOf(req), body), 201);
});

export const updateHoliday = asyncHandler(async (req, res) => {
  const { params, body } = inputOf<{ params: { id: string }; body: UpdateHolidayBody }>(req);
  sendSuccess(res, await holidayService.update(actorOf(req), params.id, body));
});

export const deleteHoliday = asyncHandler(async (req, res) => {
  const { params } = inputOf<{ params: { id: string } }>(req);
  sendSuccess(res, await holidayService.remove(actorOf(req), params.id));
});
