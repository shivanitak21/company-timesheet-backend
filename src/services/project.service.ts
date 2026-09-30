import type { FilterQuery, HydratedDocument } from 'mongoose';
import { Project, type IProject } from '../models/Project';
import { User } from '../models/User';
import type { ActorContext } from '../types/actor';
import { AppError } from '../utils/AppError';
import { pageMeta } from '../utils/http';
import { isUserLike, mapUser } from '../utils/mappers';
import { escapeRegex, isDuplicateKeyError } from '../utils/mongo';
import type { CreateProjectBody, ListProjectsQuery, UpdateProjectBody } from '../validators/project.validator';
import { recordAudit } from './audit.service';

function mapProject(project: {
  _id: unknown;
  name: string;
  code: string;
  description: string;
  status: IProject['status'];
  startDate?: string | null;
  endDate?: string | null;
  manager: unknown;
  members?: unknown[];
}) {
  return {
    id: String(project._id),
    name: project.name,
    code: project.code,
    description: project.description,
    status: project.status,
    startDate: project.startDate ?? null,
    endDate: project.endDate ?? null,
    manager: isUserLike(project.manager) ? mapUser(project.manager) : { id: String(project.manager) },
    members: (project.members ?? []).map((member) => (isUserLike(member) ? mapUser(member) : { id: String(member) })),
  };
}

type ProjectDoc = HydratedDocument<IProject>;
type ProjectQuery = { populate(path: string, select: string): ProjectQuery };

function withManager(query: ProjectQuery): Promise<ProjectDoc[]> {
  return query
    .populate('manager', 'email firstName lastName role isActive lastLoginAt')
    .populate('members', 'email firstName lastName role isActive lastLoginAt') as unknown as Promise<ProjectDoc[]>;
}

async function assertManager(managerId: string) {
  const manager = await User.findById(managerId).select('role isActive');
  if (!manager?.isActive || (manager.role !== 'manager' && manager.role !== 'admin')) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Project manager must be an active manager or admin');
  }
}

async function assertMembers(memberIds: string[]) {
  if (memberIds.length === 0) return;
  const count = await User.countDocuments({ _id: { $in: memberIds }, isActive: true, role: { $in: ['employee', 'manager', 'admin'] } });
  if (count !== memberIds.length) throw new AppError(422, 'INVALID_MEMBERS', 'One or more members are invalid');
}

export const projectService = {
  async list(actor: ActorContext, query: ListProjectsQuery) {
    const filter: FilterQuery<IProject> = {};
    if (actor.role === 'employee') {
      filter.status = 'active';
      filter.$or = [{ members: { $size: 0 } }, { members: actor.id }, { manager: actor.id }];
    } else if (query.status) {
      filter.status = query.status;
    }
    if (query.search) {
      const pattern = new RegExp(escapeRegex(query.search), 'i');
      filter.$and = [{ $or: [{ name: pattern }, { code: pattern }] }];
    }
    const skip = (query.page - 1) * query.limit;
    const [rows, total] = await Promise.all([
      withManager(Project.find(filter).sort({ name: 1 }).skip(skip).limit(query.limit)),
      Project.countDocuments(filter),
    ]);
    return { rows: rows.map((row) => mapProject(row)), meta: pageMeta(query.page, query.limit, total) };
  },

  async create(actor: ActorContext, body: CreateProjectBody) {
    await assertManager(body.managerId);
    const memberIds = [...new Set(body.memberIds)];
    await assertMembers(memberIds);
    if (body.endDate && body.startDate && body.endDate < body.startDate) {
      throw new AppError(422, 'VALIDATION_ERROR', 'End date must be on or after start date');
    }
    try {
      const project = await Project.create({
        name: body.name,
        code: body.code,
        description: body.description,
        manager: body.managerId,
        members: memberIds,
        startDate: body.startDate,
        endDate: body.endDate ?? undefined,
        status: body.status,
      });
      await recordAudit({
        actorId: actor.id,
        action: 'PROJECT_CREATED',
        entityType: 'project',
        entityId: String(project._id),
        after: { name: project.name, code: project.code },
        ip: actor.ip,
        userAgent: actor.userAgent,
      });
      const populated = await withManager(Project.find({ _id: project._id }));
      return mapProject(populated[0] ?? project);
    } catch (error) {
      if (isDuplicateKeyError(error)) throw new AppError(409, 'PROJECT_CODE_EXISTS', 'Project code already exists');
      throw error;
    }
  },

  async get(actor: ActorContext, id: string) {
    const rows = await withManager(Project.find({ _id: id }));
    const project = rows[0];
    if (!project) throw new AppError(404, 'NOT_FOUND', 'Project not found');
    if (actor.role === 'employee') {
      const members = (project.members ?? []).map((member) => String(isUserLike(member) ? member._id : member));
      const managerId = isUserLike(project.manager) ? String(project.manager._id) : String(project.manager);
      const visible = project.status === 'active' && (members.length === 0 || members.includes(actor.id) || managerId === actor.id);
      if (!visible) throw new AppError(403, 'FORBIDDEN', 'You cannot view this project');
    }
    return mapProject(project);
  },

  async update(actor: ActorContext, id: string, body: UpdateProjectBody) {
    const project = await Project.findById(id);
    if (!project) throw new AppError(404, 'NOT_FOUND', 'Project not found');
    if (actor.role !== 'admin' && String(project.manager) !== actor.id) {
      throw new AppError(403, 'FORBIDDEN', 'You cannot update this project');
    }
    if (body.managerId) await assertManager(body.managerId);
    if (body.memberIds) await assertMembers([...new Set(body.memberIds)]);
    const start = body.startDate === null ? undefined : body.startDate ?? project.startDate;
    const end = body.endDate === null ? undefined : body.endDate ?? project.endDate;
    if (start && end && end < start) throw new AppError(422, 'VALIDATION_ERROR', 'End date must be on or after start date');

    if (body.name) project.name = body.name;
    if (body.description !== undefined) project.description = body.description;
    if (body.managerId) project.manager = body.managerId as unknown as typeof project.manager;
    if (body.memberIds) project.members = [...new Set(body.memberIds)] as unknown as typeof project.members;
    if (body.status) project.status = body.status;
    if (body.startDate === null) project.startDate = undefined;
    if (body.startDate) project.startDate = body.startDate;
    if (body.endDate === null) project.endDate = undefined;
    if (body.endDate) project.endDate = body.endDate;
    await project.save();
    await recordAudit({
      actorId: actor.id,
      action: 'PROJECT_UPDATED',
      entityType: 'project',
      entityId: id,
      after: { name: project.name, status: project.status },
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
    const populated = await withManager(Project.find({ _id: project._id }));
    return mapProject(populated[0] ?? project);
  },
};
