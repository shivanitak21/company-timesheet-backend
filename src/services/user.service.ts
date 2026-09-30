import type { FilterQuery } from 'mongoose';
import { EmployeeProfile } from '../models/EmployeeProfile';
import { RefreshToken } from '../models/RefreshToken';
import { User, type IUser } from '../models/User';
import type { ActorContext } from '../types/actor';
import { AppError } from '../utils/AppError';
import { pageMeta } from '../utils/http';
import { mapProfile, mapUser } from '../utils/mappers';
import { escapeRegex, isDuplicateKeyError } from '../utils/mongo';
import { hashPassword } from '../utils/password';
import type { CreateUserBody, ListUsersQuery, UpdateUserBody } from '../validators/user.validator';
import { assertActiveManager, assertCanViewUser } from './access.service';
import { recordAudit } from './audit.service';

const SELF_FIELDS = new Set(['firstName', 'lastName']);

async function loadProfile(userId: string) {
  return EmployeeProfile.findOne({ user: userId })
    .populate('user', 'email firstName lastName role isActive lastLoginAt')
    .populate('manager', 'email firstName lastName role isActive lastLoginAt');
}

export const userService = {
  async list(query: ListUsersQuery) {
    const filter: FilterQuery<IUser> = {};
    if (query.role) filter.role = query.role;
    if (query.isActive) filter.isActive = query.isActive === 'true';
    if (query.search) {
      const pattern = new RegExp(escapeRegex(query.search), 'i');
      filter.$or = [{ email: pattern }, { firstName: pattern }, { lastName: pattern }];
    }
    const skip = (query.page - 1) * query.limit;
    const [users, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(query.limit),
      User.countDocuments(filter),
    ]);
    return { rows: users.map((user) => mapUser(user)), meta: pageMeta(query.page, query.limit, total) };
  },

  async create(actor: ActorContext, body: CreateUserBody) {
    const needsProfile = body.role !== 'admin' || Boolean(body.employeeCode || body.department || body.designation);
    if (needsProfile) {
      if (!body.employeeCode || !body.department || !body.designation || !body.joiningDate) {
        throw new AppError(422, 'VALIDATION_ERROR', 'Employee profile fields are required for this user');
      }
      if (body.role === 'employee' && !body.managerId) {
        throw new AppError(422, 'VALIDATION_ERROR', 'Employees must have a manager');
      }
    }
    if (body.managerId) await assertActiveManager(body.managerId);

    const passwordHash = await hashPassword(body.password);
    let user;
    try {
      user = await User.create({
        email: body.email,
        passwordHash,
        role: body.role,
        firstName: body.firstName,
        lastName: body.lastName,
        isActive: true,
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) throw new AppError(409, 'EMAIL_EXISTS', 'Email already exists');
      throw error;
    }

    let profile = null;
    if (needsProfile && body.employeeCode && body.department && body.designation && body.joiningDate) {
      try {
        await EmployeeProfile.create({
          user: user._id,
          employeeCode: body.employeeCode,
          department: body.department,
          designation: body.designation,
          joiningDate: body.joiningDate,
          employmentType: body.employmentType ?? 'full_time',
          weeklyHours: body.weeklyHours ?? 40,
          phone: body.phone || undefined,
          manager: body.managerId,
        });
      } catch (error) {
        await User.deleteOne({ _id: user._id });
        if (isDuplicateKeyError(error)) throw new AppError(409, 'EMPLOYEE_CODE_EXISTS', 'Employee code already exists');
        throw error;
      }
      profile = await loadProfile(String(user._id));
    }

    await recordAudit({
      actorId: actor.id,
      action: 'USER_CREATED',
      entityType: 'user',
      entityId: String(user._id),
      after: { email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName },
      ip: actor.ip,
      userAgent: actor.userAgent,
    });

    return { user: mapUser(user), profile: profile ? mapProfile(profile) : null };
  },

  async get(actor: ActorContext, userId: string) {
    await assertCanViewUser(actor, userId);
    const user = await User.findById(userId);
    if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found');
    const profile = await loadProfile(userId);
    return { user: mapUser(user), profile: profile ? mapProfile(profile) : null };
  },

  async update(actor: ActorContext, userId: string, body: UpdateUserBody) {
    const keys = Object.keys(body);
    if (actor.role !== 'admin') {
      if (actor.id !== userId) throw new AppError(403, 'FORBIDDEN', 'You cannot update this user');
      if (keys.some((key) => !SELF_FIELDS.has(key))) {
        throw new AppError(403, 'FORBIDDEN', 'You can only update your name');
      }
    }
    if (body.isActive === false && actor.id === userId) {
      throw new AppError(403, 'FORBIDDEN', 'You cannot deactivate your own account');
    }
    const user = await User.findById(userId);
    if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found');
    const before = { email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName, isActive: user.isActive };
    if (body.email) user.email = body.email;
    if (body.firstName) user.firstName = body.firstName;
    if (body.lastName) user.lastName = body.lastName;
    if (body.role) user.role = body.role;
    if (typeof body.isActive === 'boolean') user.isActive = body.isActive;
    try {
      await user.save();
    } catch (error) {
      if (isDuplicateKeyError(error)) throw new AppError(409, 'EMAIL_EXISTS', 'Email already exists');
      throw error;
    }
    if (body.isActive === false) {
      await RefreshToken.updateMany({ user: userId, revokedAt: null }, { revokedAt: new Date() });
    }
    await recordAudit({
      actorId: actor.id,
      action: body.isActive === false ? 'USER_DEACTIVATED' : body.isActive === true ? 'USER_ACTIVATED' : 'USER_UPDATED',
      entityType: 'user',
      entityId: userId,
      before,
      after: { email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName, isActive: user.isActive },
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
    return mapUser(user);
  },

  async resetPassword(actor: ActorContext, userId: string, password: string) {
    const user = await User.findById(userId);
    if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found');
    await User.updateOne(
      { _id: userId },
      { passwordHash: await hashPassword(password), passwordChangedAt: new Date() },
    );
    await RefreshToken.updateMany({ user: userId, revokedAt: null }, { revokedAt: new Date() });
    await recordAudit({
      actorId: actor.id,
      action: 'PASSWORD_RESET',
      entityType: 'user',
      entityId: userId,
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
    return { reset: true };
  },
};
