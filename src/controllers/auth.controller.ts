import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/http';
import { actorOf, clientMeta, inputOf } from '../utils/request';
import { authService } from '../services/auth.service';
import type { ChangePasswordBody, LoginBody, RefreshBody } from '../validators/auth.validator';

export const login = asyncHandler(async (req, res) => {
  const { body } = inputOf<{ body: LoginBody }>(req);
  sendSuccess(res, await authService.login(body, clientMeta(req)));
});

export const refresh = asyncHandler(async (req, res) => {
  const { body } = inputOf<{ body: RefreshBody }>(req);
  sendSuccess(res, await authService.refresh(body.refreshToken, clientMeta(req)));
});

export const logout = asyncHandler(async (req, res) => {
  const { body } = inputOf<{ body: RefreshBody }>(req);
  sendSuccess(res, await authService.logout(body.refreshToken));
});

export const logoutAll = asyncHandler(async (req, res) => {
  sendSuccess(res, await authService.logoutAll(actorOf(req).id, clientMeta(req)));
});

export const me = asyncHandler(async (req, res) => {
  sendSuccess(res, await authService.me(actorOf(req).id));
});

export const changePassword = asyncHandler(async (req, res) => {
  const { body } = inputOf<{ body: ChangePasswordBody }>(req);
  sendSuccess(res, await authService.changePassword(actorOf(req).id, body, clientMeta(req)));
});
