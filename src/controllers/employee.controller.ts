import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/http';
import { actorOf, inputOf } from '../utils/request';
import { employeeService } from '../services/employee.service';
import type { ListEmployeesQuery, UpdateEmployeeBody } from '../validators/employee.validator';

export const listEmployees = asyncHandler(async (req, res) => {
  const { query } = inputOf<{ query: ListEmployeesQuery }>(req);
  const result = await employeeService.list(actorOf(req), query);
  sendSuccess(res, result.rows, 200, result.meta);
});

export const myEmployee = asyncHandler(async (req, res) => {
  sendSuccess(res, await employeeService.me(actorOf(req)));
});

export const getEmployee = asyncHandler(async (req, res) => {
  const { params } = inputOf<{ params: { id: string } }>(req);
  sendSuccess(res, await employeeService.get(actorOf(req), params.id));
});

export const updateEmployee = asyncHandler(async (req, res) => {
  const { params, body } = inputOf<{ params: { id: string }; body: UpdateEmployeeBody }>(req);
  sendSuccess(res, await employeeService.update(actorOf(req), params.id, body));
});
