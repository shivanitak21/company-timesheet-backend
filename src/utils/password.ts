import bcrypt from 'bcryptjs';
import { env } from '../config/env';

let dummyHash: Promise<string> | null = null;

function getDummyHash(): Promise<string> {
  dummyHash ??= bcrypt.hash('dummy-password', env.BCRYPT_ROUNDS);
  return dummyHash;
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, env.BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string | undefined): Promise<boolean> {
  const comparisonHash = hash ?? (await getDummyHash());
  const matches = await bcrypt.compare(plain, comparisonHash);
  return Boolean(hash) && matches;
}
