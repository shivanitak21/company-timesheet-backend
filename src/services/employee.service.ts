import type { FilterQuery, HydratedDocument } from 'mongoose';
import { EmployeeProfile, type IEmployeeProfile } from '../models/EmployeeProfile';
import { User } from '../models/User';
import type { ActorContext } from '../types/actor';
import { AppError } from '../utils/AppError';
import { pageMeta } from '../utils/http';
import { mapProfile } from '../utils/mappers';
import { escapeRegex, isDuplicateKeyError } from '../utils/mongo';
import type { ListEmployeesQuery, UpdateEmployeeBody } from '../validators/employee.validator';
import { assertActiveManager, assertCanManageUser, assertCanViewUser } from './access.service';
import { recordAudit } from './audit.service';

const SELF_FIELDS = new Set(['phone']);
const MANAGER_FIELDS = new Set(['phone', 'department', 'designation', 'managerId']);
const ADMIN_FIELDS = new Set([...MANAGER_FIELDS, 'employeeCode', 'joiningDate', 'employmentType', 'weeklyHours']);
const USER_FIELDS = 'email firstName lastName role isActive lastLoginAt';

type ProfileDoc = HydratedDocument<IEmployeeProfile>;

function asProfile(value: unknown): ProfileDoc | null {
  return (value as ProfileDoc | null) ?? null;
}

async function findProfile(id: string): Promise<ProfileDoc | null> {
  const byId = await EmployeeProfile.findById(id).populate('user', USER_FIELDS).populate('manager', USER_FIELDS);
  if (byId) return asProfile(byId);
  return asProfile(await EmployeeProfile.findOne({ user: id }).populate('user', USER_FIELDS).populate('manager', USER_FIELDS));
}

export const employeeService = {
  async list(actor: ActorContext, query: ListEmployeesQuery) {
    const clauses: FilterQuery<IEmployeeProfile>[] = [];
    if (query.department) clauses.push({ department: new RegExp(`^${escapeRegex(query.department)}$`, 'i') });
    if (query.managerId) clauses.push({ manager: query.managerId });
    if (actor.role === 'employee') clauses.push({ user: actor.id });
    if (actor.role === 'manager') clauses.push({ $or: [{ manager: actor.id }, { user: actor.id }] });
    if (query.search) {
      const pattern = new RegExp(escapeRegex(query.search), 'i');
      const users = await User.find({ $or: [{ email: pattern }, { firstName: pattern }, { lastName: pattern }] }).select('_id');
      clauses.push({ $or: [{ employeeCode: pattern }, { user: { $in: users.map((user) => user._id) } }] });
    }
    const filter: FilterQuery<IEmployeeProfile> = clauses.length > 0 ? { $and: clauses } : {};
    const skip = (query.page - 1) * query.limit;
    const [rows, total] = await Promise.all([
      EmployeeProfile.find(filter)
        .sort({ employeeCode: 1 })
        .skip(skip)
        .limit(query.limit)
        .populate('user', 'email firstName lastName role isActive lastLoginAt')
        .populate('manager', 'email firstName lastName role isActive lastLoginAt'),
      EmployeeProfile.countDocuments(filter),
    ]);
    const profiles = rows as unknown as ProfileDoc[];
    return { rows: profiles.map((row) => mapProfile(row)), meta: pageMeta(query.page, query.limit, total) };
  },

  async me(actor: ActorContext) {
    const profile = asProfile(
      await EmployeeProfile.findOne({ user: actor.id }).populate('user', USER_FIELDS).populate('manager', USER_FIELDS),
    );
    if (!profile) throw new AppError(404, 'PROFILE_NOT_FOUND', 'Employee profile not found');
    return mapProfile(profile);
  },

  async get(actor: ActorContext, id: string) {
    const profile = await findProfile(id);
    if (!profile) throw new AppError(404, 'NOT_FOUND', 'Employee profile not found');
    const targetUserId = profile.populated('user') ? String((profile.user as { _id: unknown })._id) : String(profile.user);
    await assertCanViewUser(actor, targetUserId);
    return mapProfile(profile);
  },

  async update(actor: ActorContext, id: string, body: UpdateEmployeeBody) {
    const profile = await findProfile(id);
    if (!profile) throw new AppError(404, 'NOT_FOUND', 'Employee profile not found');
    const targetUserId = profile.populated('user') ? String((profile.user as { _id: unknown })._id) : String(profile.user);

    let allowed = SELF_FIELDS;
    if (actor.role === 'admin') {
      allowed = ADMIN_FIELDS;
    } else if (actor.id === targetUserId) {
      allowed = SELF_FIELDS;
    } else {
      await assertCanManageUser(actor, targetUserId);
      allowed = MANAGER_FIELDS;
    }

    const keys = Object.keys(body);
    if (keys.some((key) => !allowed.has(key))) {
      throw new AppError(403, 'FORBIDDEN', 'You cannot update one or more of these fields');
    }

    if (body.managerId) await assertActiveManager(body.managerId, targetUserId);
    if (body.managerId === null) {
      const user = await User.findById(targetUserId).select('role');
      if (user?.role === 'employee') {
        throw new AppError(422, 'VALIDATION_ERROR', 'Employees must have a manager');
      }
    }

    const before = {
      employeeCode: profile.employeeCode,
      department: profile.department,
      designation: profile.designation,
      manager: profile.manager ? String((profile.manager as { _id?: unknown })._id ?? profile.manager) : null,
    };

    if (body.phone !== undefined) profile.phone = body.phone;
    if (body.department) profile.department = body.department;
    if (body.designation) profile.designation = body.designation;
    if (body.employeeCode) profile.employeeCode = body.employeeCode;
    if (body.joiningDate) profile.joiningDate = body.joiningDate;
    if (body.employmentType) profile.employmentType = body.employmentType;
    if (body.weeklyHours) profile.weeklyHours = body.weeklyHours;
    if (body.managerId === null) profile.manager = undefined;
    if (body.managerId) profile.manager = body.managerId as unknown as typeof profile.manager;

    try {
      await profile.save();
    } catch (error) {
      if (isDuplicateKeyError(error)) throw new AppError(409, 'EMPLOYEE_CODE_EXISTS', 'Employee code already exists');
      throw error;
    }

    await recordAudit({
      actorId: actor.id,
      action: 'USER_UPDATED',
      entityType: 'employee_profile',
      entityId: String(profile._id),
      before,
      after: {
        employeeCode: profile.employeeCode,
        department: profile.department,
        designation: profile.designation,
        manager: body.managerId === null ? null : body.managerId ?? before.manager,
      },
      ip: actor.ip,
      userAgent: actor.userAgent,
    });

    const fresh = await findProfile(String(profile._id));
    if (!fresh) throw new AppError(404, 'NOT_FOUND', 'Employee profile not found');
    return mapProfile(fresh);
  },
};
