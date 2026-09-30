import type { LockReason, TimesheetStatus } from '../types/enums';
import { isFutureDate, isPreviousMonth, isWeekendDate } from './dates';

const LOCK_MESSAGES: Record<LockReason, string> = {
  weekend: 'Weekends are not fillable.',
  holiday: 'Company holidays are not fillable.',
  leave: 'Approved leave dates are not fillable.',
  future: 'Future dates cannot be filled.',
  previous_month: 'Previous months are locked.',
  pending_approval: 'Submitted timesheets are pending approval and cannot be edited.',
  approved: 'Approved timesheets are locked.',
};

export type FillabilityInput = {
  date: string;
  today: string;
  isHoliday: boolean;
  isOnApprovedLeave: boolean;
  timesheetStatus: TimesheetStatus | null;
};

export function evaluateFillability(input: FillabilityInput): { isFillable: boolean; lockReasons: LockReason[] } {
  const lockReasons: LockReason[] = [];
  if (isWeekendDate(input.date)) lockReasons.push('weekend');
  if (input.isHoliday) lockReasons.push('holiday');
  if (input.isOnApprovedLeave) lockReasons.push('leave');
  if (isFutureDate(input.date, input.today)) lockReasons.push('future');
  if (isPreviousMonth(input.date, input.today)) lockReasons.push('previous_month');
  if (input.timesheetStatus === 'submitted') lockReasons.push('pending_approval');
  if (input.timesheetStatus === 'approved') lockReasons.push('approved');
  return { isFillable: lockReasons.length === 0, lockReasons };
}

export function evaluateStructuralLock(input: {
  date: string;
  today: string;
  timesheetStatus: TimesheetStatus | null;
}): { locked: boolean; lockReasons: LockReason[] } {
  const lockReasons: LockReason[] = [];
  if (isFutureDate(input.date, input.today)) lockReasons.push('future');
  if (isPreviousMonth(input.date, input.today)) lockReasons.push('previous_month');
  if (input.timesheetStatus === 'submitted') lockReasons.push('pending_approval');
  if (input.timesheetStatus === 'approved') lockReasons.push('approved');
  return { locked: lockReasons.length > 0, lockReasons };
}

export function lockMessage(reasons: readonly LockReason[]): string {
  if (reasons.length === 0) return 'This date cannot be filled.';
  return reasons.map((reason) => LOCK_MESSAGES[reason]).join(' ');
}
