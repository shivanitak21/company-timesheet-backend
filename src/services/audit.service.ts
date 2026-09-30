import { AuditLog } from '../models/AuditLog';
import { pageMeta } from '../utils/http';
import { isUserLike, mapUser } from '../utils/mappers';

export async function recordAudit(input: {
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  ip?: string;
  userAgent?: string;
}): Promise<void> {
  await AuditLog.create({
    actor: input.actorId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    before: (input.before ?? null) as Record<string, unknown> | null,
    after: (input.after ?? null) as Record<string, unknown> | null,
    ip: input.ip,
    userAgent: input.userAgent,
  });
}

export async function listAudit(query: { page: number; limit: number; entityType?: string; actorId?: string }) {
  const filter: Record<string, unknown> = {};
  if (query.entityType) filter.entityType = query.entityType;
  if (query.actorId) filter.actor = query.actorId;
  const skip = (query.page - 1) * query.limit;
  const [rows, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(query.limit)
      .populate('actor', 'email firstName lastName role isActive lastLoginAt')
      .lean(),
    AuditLog.countDocuments(filter),
  ]);

  return {
    rows: rows.map((row) => ({
      id: String(row._id),
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      before: row.before ?? null,
      after: row.after ?? null,
      ip: row.ip ?? null,
      userAgent: row.userAgent ?? null,
      createdAt: row.createdAt,
      actor: isUserLike(row.actor) ? mapUser(row.actor) : null,
    })),
    meta: pageMeta(query.page, query.limit, total),
  };
}
