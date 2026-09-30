import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import { JWT_AUDIENCE, JWT_ISSUER } from '../config/constants';
import type { Role } from '../types/enums';

export type AccessClaims = {
  sub: string;
  role: Role;
  type: 'access';
  iat: number;
  exp: number;
};

export type RefreshClaims = {
  sub: string;
  role: Role;
  type: 'refresh';
  jti: string;
  family: string;
  iat: number;
  exp: number;
};

function signOptions(expiresIn: string): SignOptions {
  return {
    expiresIn: expiresIn as SignOptions['expiresIn'],
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  };
}

export function signAccessToken(input: { sub: string; role: Role }): string {
  return jwt.sign({ sub: input.sub, role: input.role, type: 'access' }, env.JWT_ACCESS_SECRET, signOptions(env.JWT_ACCESS_EXPIRES_IN));
}

export function signRefreshToken(input: { sub: string; role: Role; jti: string; family: string }): string {
  return jwt.sign(
    { sub: input.sub, role: input.role, type: 'refresh', jti: input.jti, family: input.family },
    env.JWT_REFRESH_SECRET,
    signOptions(env.JWT_REFRESH_EXPIRES_IN),
  );
}

export function verifyAccessToken(token: string): AccessClaims | null {
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, { issuer: JWT_ISSUER, audience: JWT_AUDIENCE });
    if (typeof payload === 'string') return null;
    if (payload.type !== 'access' || typeof payload.sub !== 'string') return null;
    return payload as AccessClaims;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): RefreshClaims | null {
  try {
    const payload = jwt.verify(token, env.JWT_REFRESH_SECRET, { issuer: JWT_ISSUER, audience: JWT_AUDIENCE });
    if (typeof payload === 'string') return null;
    if (payload.type !== 'refresh' || typeof payload.sub !== 'string' || typeof payload.jti !== 'string') return null;
    return payload as RefreshClaims;
  } catch {
    return null;
  }
}
