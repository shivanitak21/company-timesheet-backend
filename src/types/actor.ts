import type { Role } from './enums';

export type ActorContext = {
  id: string;
  role: Role;
  email: string;
  ip?: string;
  userAgent?: string;
};

export type PageMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};
