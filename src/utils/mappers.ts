import type { EmploymentType, Role, TimesheetStatus, WorkType } from '../types/enums';

export type UserLike = {
  _id: unknown;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  isActive: boolean;
  lastLoginAt?: Date | null;
};

export function mapUser(user: UserLike) {
  return {
    id: String(user._id),
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt ?? null,
  };
}

export function isUserLike(value: unknown): value is UserLike {
  return typeof value === 'object' && value !== null && 'email' in value && 'firstName' in value && '_id' in value;
}

export function mapProfile(profile: {
  _id: unknown;
  employeeCode: string;
  department: string;
  designation: string;
  joiningDate: string;
  employmentType: EmploymentType;
  weeklyHours: number;
  phone?: string | null;
  user: unknown;
  manager?: unknown;
}) {
  return {
    id: String(profile._id),
    employeeCode: profile.employeeCode,
    department: profile.department,
    designation: profile.designation,
    joiningDate: profile.joiningDate,
    employmentType: profile.employmentType,
    weeklyHours: profile.weeklyHours,
    phone: profile.phone ?? null,
    user: isUserLike(profile.user) ? mapUser(profile.user) : null,
    manager: isUserLike(profile.manager) ? mapUser(profile.manager) : null,
  };
}

export function mapAttendance(record: {
  _id: unknown;
  user: unknown;
  date: string;
  status: 'checked_in' | 'checked_out';
  checkInAt: Date;
  checkOutAt?: Date | null;
  workMinutes?: number | null;
  notes?: string | null;
  platform: 'web' | 'mobile' | 'unknown';
}) {
  const userId = isUserLike(record.user) ? String(record.user._id) : String(record.user);
  return {
    id: String(record._id),
    userId,
    date: record.date,
    status: record.status,
    checkInAt: record.checkInAt,
    checkOutAt: record.checkOutAt ?? null,
    workMinutes: record.workMinutes ?? null,
    notes: record.notes ?? null,
    platform: record.platform,
  };
}

export function mapTimesheet(sheet: {
  _id: unknown;
  user: unknown;
  year: number;
  month: number;
  status: TimesheetStatus;
  totalMinutes: number;
  submittedAt?: Date | null;
  reviewedAt?: Date | null;
  rejectionReason?: string | null;
  reviewedBy?: unknown;
}) {
  const userId = isUserLike(sheet.user) ? String(sheet.user._id) : String(sheet.user);
  return {
    id: String(sheet._id),
    userId,
    year: sheet.year,
    month: sheet.month,
    status: sheet.status,
    totalMinutes: sheet.totalMinutes,
    submittedAt: sheet.submittedAt ?? null,
    reviewedAt: sheet.reviewedAt ?? null,
    rejectionReason: sheet.rejectionReason ?? null,
    reviewedBy: isUserLike(sheet.reviewedBy)
      ? { id: String(sheet.reviewedBy._id), firstName: sheet.reviewedBy.firstName, lastName: sheet.reviewedBy.lastName }
      : null,
  };
}

export function mapEntry(entry: {
  _id: unknown;
  date: string;
  workType: WorkType;
  description: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  project?: unknown;
  task?: unknown;
}) {
  const project = asNamed(entry.project);
  const task = asTitled(entry.task);
  return {
    id: String(entry._id),
    date: entry.date,
    workType: entry.workType,
    description: entry.description,
    startTime: entry.startTime,
    endTime: entry.endTime,
    durationMinutes: entry.durationMinutes,
    project: project ? { id: String(project._id), name: project.name, code: project.code } : null,
    task: task ? { id: String(task._id), title: task.title } : null,
  };
}

function asNamed(value: unknown): { _id: unknown; name: string; code: string } | null {
  if (typeof value !== 'object' || value === null || !('name' in value) || !('code' in value)) return null;
  const record = value as { _id: unknown; name: string; code: string };
  return record;
}

function asTitled(value: unknown): { _id: unknown; title: string } | null {
  if (typeof value !== 'object' || value === null || !('title' in value)) return null;
  return value as { _id: unknown; title: string };
}
