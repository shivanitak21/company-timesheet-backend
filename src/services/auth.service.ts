import { randomUUID } from 'crypto';
import { env } from '../config/env';
import { EmployeeProfile } from '../models/EmployeeProfile';
import { RefreshToken } from '../models/RefreshToken';
import { User } from '../models/User';
import type { Role } from '../types/enums';
import { AppError } from '../utils/AppError';
import { mapProfile, mapUser } from '../utils/mappers';
import { hashPassword, verifyPassword } from '../utils/password';
import { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken } from '../utils/tokens';
import { recordAudit } from './audit.service';
import type { ChangePasswordBody, LoginBody } from '../validators/auth.validator';

type ClientMeta = { ip?: string; userAgent?: string };

async function issueTokens(user: { _id: unknown; role: Role }, meta: ClientMeta) {
  const jti = randomUUID();
  const family = randomUUID();
  const accessToken = signAccessToken({ sub: String(user._id), role: user.role });
  const refreshToken = signRefreshToken({ sub: String(user._id), role: user.role, jti, family });
  const claims = verifyRefreshToken(refreshToken);
  await RefreshToken.create({
    user: user._id,
    jti,
    family,
    expiresAt: new Date((claims?.exp ?? Math.floor(Date.now() / 1000) + 7 * 24 * 3600) * 1000),
    userAgent: meta.userAgent,
    ip: meta.ip,
  });
  return { accessToken, refreshToken, accessTokenExpiresIn: env.JWT_ACCESS_EXPIRES_IN };
}

export const authService = {
  async login(body: LoginBody, meta: ClientMeta) {
    const user = await User.findOne({ email: body.email }).select('+passwordHash');
    const valid = await verifyPassword(body.password, user?.passwordHash);
    if (!user || !valid) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }
    if (!user.isActive) {
      throw new AppError(403, 'ACCOUNT_DISABLED', 'Account is disabled');
    }
    user.lastLoginAt = new Date();
    await user.save();
    const tokens = await issueTokens(user, meta);
    await recordAudit({
      actorId: String(user._id),
      action: 'LOGIN',
      entityType: 'user',
      entityId: String(user._id),
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return { ...tokens, user: mapUser(user) };
  },

  async refresh(refreshToken: string, meta: ClientMeta) {
    const claims = verifyRefreshToken(refreshToken);
    if (!claims?.jti || !claims.family) {
      throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Refresh token is invalid or expired');
    }
    const record = await RefreshToken.findOne({ jti: claims.jti });
    if (!record) {
      throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Refresh token is invalid or expired');
    }
    if (record.revokedAt) {
      await RefreshToken.updateMany({ family: record.family, revokedAt: null }, { revokedAt: new Date() });
      throw new AppError(401, 'REFRESH_TOKEN_REUSED', 'Refresh token reuse detected. All sessions in this family were revoked.');
    }
    const user = await User.findById(record.user);
    if (!user) {
      throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Refresh token is invalid or expired');
    }
    if (!user.isActive) {
      throw new AppError(403, 'ACCOUNT_DISABLED', 'Account is disabled');
    }

    const nextJti = randomUUID();
    const rotated = await RefreshToken.findOneAndUpdate(
      { _id: record._id, revokedAt: null },
      { revokedAt: new Date(), replacedByJti: nextJti },
    );
    if (!rotated) {
      await RefreshToken.updateMany({ family: record.family, revokedAt: null }, { revokedAt: new Date() });
      throw new AppError(401, 'REFRESH_TOKEN_REUSED', 'Refresh token reuse detected. All sessions in this family were revoked.');
    }

    const accessToken = signAccessToken({ sub: String(user._id), role: user.role });
    const nextRefresh = signRefreshToken({ sub: String(user._id), role: user.role, jti: nextJti, family: record.family });
    const nextClaims = verifyRefreshToken(nextRefresh);
    await RefreshToken.create({
      user: user._id,
      jti: nextJti,
      family: record.family,
      expiresAt: new Date((nextClaims?.exp ?? Math.floor(Date.now() / 1000) + 7 * 24 * 3600) * 1000),
      userAgent: meta.userAgent,
      ip: meta.ip,
    });
    return {
      accessToken,
      refreshToken: nextRefresh,
      accessTokenExpiresIn: env.JWT_ACCESS_EXPIRES_IN,
      user: mapUser(user),
    };
  },

  async logout(refreshToken: string) {
    const claims = verifyRefreshToken(refreshToken);
    if (!claims) return { revoked: false };
    const result = await RefreshToken.updateOne({ jti: claims.jti, revokedAt: null }, { revokedAt: new Date() });
    if (result.modifiedCount > 0) {
      await recordAudit({
        actorId: claims.sub,
        action: 'LOGOUT',
        entityType: 'user',
        entityId: claims.sub,
      });
    }
    return { revoked: result.modifiedCount > 0 };
  },

  async logoutAll(userId: string, meta: ClientMeta) {
    await RefreshToken.updateMany({ user: userId, revokedAt: null }, { revokedAt: new Date() });
    await recordAudit({
      actorId: userId,
      action: 'LOGOUT_ALL',
      entityType: 'user',
      entityId: userId,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return { revoked: true };
  },

  async me(userId: string) {
    const user = await User.findById(userId);
    if (!user || !user.isActive) {
      throw new AppError(401, 'INVALID_ACCESS_TOKEN', 'Access token is invalid or expired');
    }
    const profile = await EmployeeProfile.findOne({ user: userId }).populate('user', 'email firstName lastName role isActive lastLoginAt').populate('manager', 'email firstName lastName role isActive lastLoginAt');
    return {
      user: mapUser(user),
      profile: profile ? mapProfile(profile) : null,
    };
  },

  async changePassword(userId: string, body: ChangePasswordBody, meta: ClientMeta) {
    const user = await User.findById(userId).select('+passwordHash');
    if (!user) throw new AppError(401, 'INVALID_ACCESS_TOKEN', 'Access token is invalid or expired');
    const valid = await verifyPassword(body.currentPassword, user.passwordHash);
    if (!valid) throw new AppError(401, 'INVALID_CREDENTIALS', 'Current password is incorrect');
    user.passwordHash = await hashPassword(body.newPassword);
    user.passwordChangedAt = new Date();
    await user.save();
    await RefreshToken.updateMany({ user: userId, revokedAt: null }, { revokedAt: new Date() });
    await recordAudit({
      actorId: userId,
      action: 'PASSWORD_CHANGED',
      entityType: 'user',
      entityId: userId,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return { changed: true };
  },

  async authenticateAccessToken(token: string) {
    const claims = verifyAccessToken(token);
    if (!claims) {
      throw new AppError(401, 'INVALID_ACCESS_TOKEN', 'Access token is invalid or expired');
    }
    const user = await User.findById(claims.sub).select('role email isActive passwordChangedAt');
    if (!user || !user.isActive) {
      throw new AppError(401, 'INVALID_ACCESS_TOKEN', 'Access token is invalid or expired');
    }
    if (user.passwordChangedAt && claims.iat * 1000 < user.passwordChangedAt.getTime()) {
      throw new AppError(401, 'TOKEN_REVOKED', 'Access token is no longer valid');
    }
    return { id: String(user._id), role: user.role, email: user.email };
  },
};
