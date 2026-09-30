import type { FilterQuery, HydratedDocument } from 'mongoose';
import { Project } from '../models/Project';
import { Task, type ITask } from '../models/Task';
import { User } from '../models/User';
import type { ActorContext } from '../types/actor';
import { AppError } from '../utils/AppError';
import { pageMeta } from '../utils/http';
import { isUserLike, mapUser } from '../utils/mappers';
import type { CreateTaskBody, ListTasksQuery, UpdateTaskBody } from '../validators/task.validator';
import { assertCanAssignTo, directReportIds } from './access.service';
import { recordAudit } from './audit.service';
import { notify } from './notification.service';

const ASSIGNEE_STATUSES = new Set(['todo', 'in_progress', 'done']);

function mapTask(task: {
  _id: unknown;
  title: string;
  description: string;
  status: ITask['status'];
  priority: ITask['priority'];
  dueDate?: string | null;
  estimatedMinutes?: number | null;
  project: unknown;
  assignedTo: unknown;
  assignedBy: unknown;
  createdAt?: Date;
  updatedAt?: Date;
}) {
  const rawProject = task.project as unknown;
  const named = typeof rawProject === 'object' && rawProject !== null && 'name' in rawProject
    ? (rawProject as unknown as { _id: unknown; name: string; code: string })
    : null;
  const project = named
    ? { id: String(named._id), name: named.name, code: named.code }
    : { id: String(rawProject) };
  return {
    id: String(task._id),
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate ?? null,
    estimatedMinutes: task.estimatedMinutes ?? null,
    project,
    assignedTo: isUserLike(task.assignedTo) ? mapUser(task.assignedTo) : { id: String(task.assignedTo) },
    assignedBy: isUserLike(task.assignedBy) ? mapUser(task.assignedBy) : { id: String(task.assignedBy) },
    createdAt: task.createdAt ?? null,
    updatedAt: task.updatedAt ?? null,
  };
}

type TaskDoc = HydratedDocument<ITask>;
type TaskQuery = { populate(path: string, select: string): TaskQuery };

function withPeople(query: TaskQuery): Promise<TaskDoc[]> {
  return query
    .populate('project', 'name code')
    .populate('assignedTo', 'email firstName lastName role isActive lastLoginAt')
    .populate('assignedBy', 'email firstName lastName role isActive lastLoginAt') as unknown as Promise<TaskDoc[]>;
}

async function assertAssignee(userId: string) {
  const user = await User.findById(userId).select('role isActive');
  if (!user?.isActive || (user.role !== 'employee' && user.role !== 'manager')) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Assignee must be an active employee or manager');
  }
}

async function assertProjectAllows(projectId: string, assigneeId: string) {
  const project = await Project.findById(projectId);
  if (!project || project.status !== 'active') throw new AppError(409, 'PROJECT_UNAVAILABLE', 'Project is not available');
  const members = project.members.map((member) => String(member));
  if (members.length > 0 && !members.includes(assigneeId) && String(project.manager) !== assigneeId) {
    throw new AppError(409, 'PROJECT_UNAVAILABLE', 'Assignee is not a member of this project');
  }
  return project;
}

async function canManageTask(actor: ActorContext, task: { assignedBy: unknown; assignedTo: unknown; project: unknown }) {
  if (actor.role === 'admin') return true;
  if (String(task.assignedBy) === actor.id) return true;
  const project = await Project.findById(typeof task.project === 'object' && task.project && '_id' in task.project ? (task.project as { _id: unknown })._id : task.project).select('manager');
  if (project && String(project.manager) === actor.id) return true;
  if (actor.role === 'manager') {
    const reports = await directReportIds(actor.id);
    if (reports.includes(String(task.assignedTo && typeof task.assignedTo === 'object' && '_id' in task.assignedTo ? (task.assignedTo as { _id: unknown })._id : task.assignedTo))) {
      return true;
    }
  }
  return false;
}

export const taskService = {
  async assigned(actor: ActorContext, query: ListTasksQuery) {
    const filter: FilterQuery<ITask> = { assignedTo: actor.id };
    filter.status = query.status ?? { $in: ['todo', 'in_progress', 'done'] };
    return paginate(filter, query.page, query.limit);
  },

  async list(actor: ActorContext, query: ListTasksQuery) {
    const filter: FilterQuery<ITask> = {};
    if (query.status) filter.status = query.status;
    if (actor.role === 'employee') {
      filter.assignedTo = actor.id;
    } else if (actor.role === 'manager') {
      const reports = await directReportIds(actor.id);
      filter.assignedTo = { $in: [actor.id, ...reports] };
    }
    return paginate(filter, query.page, query.limit);
  },

  async create(actor: ActorContext, body: CreateTaskBody) {
    await assertCanAssignTo(actor, body.assignedTo);
    await assertAssignee(body.assignedTo);
    const project = await assertProjectAllows(body.projectId, body.assignedTo);
    const task = await Task.create({
      project: project._id,
      title: body.title,
      description: body.description,
      assignedTo: body.assignedTo,
      assignedBy: actor.id,
      priority: body.priority,
      dueDate: body.dueDate,
      estimatedMinutes: body.estimatedMinutes,
      status: 'todo',
    });
    await notify(body.assignedTo, {
      type: 'task_assigned',
      title: 'New task assigned',
      message: `You were assigned "${body.title}".`,
      metadata: { taskId: String(task._id), projectId: String(project._id) },
    });
    await recordAudit({
      actorId: actor.id,
      action: 'TASK_CREATED',
      entityType: 'task',
      entityId: String(task._id),
      after: { title: task.title, assignedTo: body.assignedTo },
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
    const populated = await withPeople(Task.find({ _id: task._id }));
    return mapTask(populated[0] ?? task);
  },

  async get(actor: ActorContext, id: string) {
    const rows = await withPeople(Task.find({ _id: id }));
    const task = rows[0];
    if (!task) throw new AppError(404, 'NOT_FOUND', 'Task not found');
    const assigneeId = isUserLike(task.assignedTo) ? String(task.assignedTo._id) : String(task.assignedTo);
    const assignerId = isUserLike(task.assignedBy) ? String(task.assignedBy._id) : String(task.assignedBy);
    const allowed = actor.id === assigneeId || actor.id === assignerId || (await canManageTask(actor, task));
    if (!allowed) throw new AppError(403, 'FORBIDDEN', 'You cannot view this task');
    return mapTask(task);
  },

  async update(actor: ActorContext, id: string, body: UpdateTaskBody) {
    const task = await Task.findById(id);
    if (!task) throw new AppError(404, 'NOT_FOUND', 'Task not found');
    const assigneeId = String(task.assignedTo);
    const keys = Object.keys(body);
    const statusOnly = keys.length > 0 && keys.every((key) => key === 'status');
    const manages = await canManageTask(actor, task);
    if (!manages) {
      if (actor.id !== assigneeId || !statusOnly || (body.status && !ASSIGNEE_STATUSES.has(body.status))) {
        throw new AppError(403, 'FORBIDDEN', 'You can only update the status of your own task');
      }
    }
    if (body.assignedTo && body.assignedTo !== assigneeId) {
      await assertCanAssignTo(actor, body.assignedTo);
      await assertAssignee(body.assignedTo);
    }
    const projectId = body.projectId ?? String(task.project);
    const nextAssignee = body.assignedTo ?? assigneeId;
    if (body.projectId || body.assignedTo) await assertProjectAllows(projectId, nextAssignee);

    if (body.title) task.title = body.title;
    if (body.description !== undefined) task.description = body.description;
    if (body.priority) task.priority = body.priority;
    if (body.status) task.status = body.status;
    if (body.dueDate === null) task.dueDate = undefined;
    if (body.dueDate) task.dueDate = body.dueDate;
    if (body.estimatedMinutes === null) task.estimatedMinutes = undefined;
    if (body.estimatedMinutes) task.estimatedMinutes = body.estimatedMinutes;
    if (body.assignedTo) task.assignedTo = body.assignedTo as unknown as typeof task.assignedTo;
    if (body.projectId) task.project = body.projectId as unknown as typeof task.project;
    await task.save();

    if (body.assignedTo && body.assignedTo !== assigneeId) {
      await notify(body.assignedTo, {
        type: 'task_assigned',
        title: 'New task assigned',
        message: `You were assigned "${task.title}".`,
        metadata: { taskId: String(task._id) },
      });
    }
    await recordAudit({
      actorId: actor.id,
      action: 'TASK_UPDATED',
      entityType: 'task',
      entityId: id,
      after: { status: task.status, title: task.title, assignedTo: String(task.assignedTo) },
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
    const populated = await withPeople(Task.find({ _id: task._id }));
    return mapTask(populated[0] ?? task);
  },
};

async function paginate(filter: FilterQuery<ITask>, page: number, limit: number) {
  const skip = (page - 1) * limit;
  const [rows, total] = await Promise.all([
    withPeople(Task.find(filter).sort({ dueDate: 1, createdAt: -1 }).skip(skip).limit(limit)),
    Task.countDocuments(filter),
  ]);
  return { rows: rows.map((row) => mapTask(row)), meta: pageMeta(page, limit, total) };
}
