import type { ActorContext } from '../types/actor';
import { EmployeeProfile } from '../models/EmployeeProfile';
import { User } from '../models/User';
import { AppError } from '../utils/AppError';

export async function assertCanViewUser(actor: ActorContext, targetUserId: string): Promise<void> {
  if (actor.role === 'admin' || actor.id === targetUserId) return;
  if (actor.role === 'manager') {
    const profile = await EmployeeProfile.findOne({ user: targetUserId, manager: actor.id }).select('_id');
    if (profile) return;
  }
  throw new AppError(403, 'FORBIDDEN', 'You cannot access this employee');
}

export async function assertCanManageUser(actor: ActorContext, targetUserId: string): Promise<void> {
  if (actor.id === targetUserId) {
    throw new AppError(403, 'FORBIDDEN', 'You cannot review your own request');
  }
  if (actor.role === 'admin') return;
  if (actor.role === 'manager') {
    const profile = await EmployeeProfile.findOne({ user: targetUserId, manager: actor.id }).select('_id');
    if (profile) return;
  }
  throw new AppError(403, 'FORBIDDEN', 'You cannot review this employee');
}

export async function assertCanAssignTo(actor: ActorContext, targetUserId: string): Promise<void> {
  if (actor.role === 'admin') return;
  if (actor.role === 'manager') {
    if (actor.id === targetUserId) return;
    const profile = await EmployeeProfile.findOne({ user: targetUserId, manager: actor.id }).select('_id');
    if (profile) return;
  }
  throw new AppError(403, 'FORBIDDEN', 'You cannot assign work to this employee');
}

export async function assertActiveManager(managerId: string, userId?: string): Promise<void> {
  if (userId && managerId === userId) {
    throw new AppError(422, 'VALIDATION_ERROR', 'A user cannot be their own manager');
  }
  const manager = await User.findById(managerId).select('role isActive');
  if (!manager?.isActive || (manager.role !== 'manager' && manager.role !== 'admin')) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Manager must be an active manager or admin');
  }
}

export async function directReportIds(managerId: string): Promise<string[]> {
  const profiles = await EmployeeProfile.find({ manager: managerId }).select('user');
  return profiles.map((profile) => String(profile.user));
}

export async function resolveVisibleUserIds(actor: ActorContext, requestedUserId?: string): Promise<string[]> {
  if (requestedUserId) {
    await assertCanViewUser(actor, requestedUserId);
    return [requestedUserId];
  }
  if (actor.role === 'employee') return [actor.id];
  if (actor.role === 'manager') {
    const reports = await directReportIds(actor.id);
    return [actor.id, ...reports];
  }
  const users = await User.find({ role: { $in: ['employee', 'manager'] }, isActive: true }).select('_id');
  return users.map((user) => String(user._id));
}
