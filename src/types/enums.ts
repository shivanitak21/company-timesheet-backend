export const ROLES = ['employee', 'manager', 'admin'] as const;
export type Role = (typeof ROLES)[number];

export const TIMESHEET_STATUSES = ['draft', 'submitted', 'approved', 'rejected'] as const;
export type TimesheetStatus = (typeof TIMESHEET_STATUSES)[number];

export const WORK_TYPES = ['assigned', 'unassigned'] as const;
export type WorkType = (typeof WORK_TYPES)[number];

export const ATTENDANCE_STATUSES = ['checked_in', 'checked_out'] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const LEAVE_TYPES = ['annual', 'sick', 'unpaid', 'other'] as const;
export type LeaveType = (typeof LEAVE_TYPES)[number];

export const LEAVE_STATUSES = ['pending', 'approved', 'rejected', 'cancelled'] as const;
export type LeaveStatus = (typeof LEAVE_STATUSES)[number];

export const TASK_STATUSES = ['todo', 'in_progress', 'done', 'cancelled'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const PRIORITIES = ['low', 'medium', 'high'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const PROJECT_STATUSES = ['active', 'archived'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const EMPLOYMENT_TYPES = ['full_time', 'part_time', 'contract'] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export const PLATFORMS = ['web', 'mobile', 'unknown'] as const;
export type Platform = (typeof PLATFORMS)[number];

export const LOCK_REASONS = [
  'weekend',
  'holiday',
  'leave',
  'future',
  'previous_month',
  'pending_approval',
  'approved',
] as const;
export type LockReason = (typeof LOCK_REASONS)[number];
