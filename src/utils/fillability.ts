import type { LockReason, TimesheetStatus } from '../types/enums';
import { entryWindowBounds, isFutureDate, isPreviousMonth, isWeekendDate, isWithinEntryWindow } from './dates';

export const ENTRY_WINDOW_ERROR = 'Timesheets can only be entered for today and yesterday.';
export const ENTRY_WINDOW_NOTICE = 'Timesheet entry is open for today and yesterday only.';

const LOCK_MESSAGES: Record<LockReason, string> = {
  weekend: 'Weekends are not fillable.',
  holiday: 'Company holidays are not fillable.',
  leave: 'Approved leave dates are not fillable.',
  future: 'Future dates cannot be filled.',
  previous_month: 'Previous months are locked.',
  entry_window: 'Entry window closed',
  pending_approval: 'Submitted timesheets are pending approval and cannot be edited.',
  approved: 'Approved timesheets are locked.',
};

export type FillabilityInput = {
  date: string;
  today: string;
  isHoliday: boolean;
  isOnApprovedLeave: boolean;
  timesheetStatus: TimesheetStatus | null;
  bypassPastWindow?: boolean;
};

function applyEntryWindow(lockReasons: LockReason[], input: FillabilityInput) {
  const inWindow = isWithinEntryWindow(input.date, input.today);
  const pastBeyondYesterday = input.date < input.today && !inWindow;
  if (!inWindow && !(input.bypassPastWindow && pastBeyondYesterday)) {
    lockReasons.push('entry_window');
  }
  if (isFutureDate(input.date, input.today)) lockReasons.push('future');
  if (isPreviousMonth(input.date, input.today) && !inWindow && !(input.bypassPastWindow && pastBeyondYesterday)) {
    lockReasons.push('previous_month');
  }
}

export function evaluateFillability(input: FillabilityInput): { isFillable: boolean; lockReasons: LockReason[] } {
  const lockReasons: LockReason[] = [];
  if (isWeekendDate(input.date)) lockReasons.push('weekend');
  if (input.isHoliday) lockReasons.push('holiday');
  if (input.isOnApprovedLeave) lockReasons.push('leave');
  applyEntryWindow(lockReasons, input);
  if (input.timesheetStatus === 'submitted') lockReasons.push('pending_approval');
  if (input.timesheetStatus === 'approved') lockReasons.push('approved');
  return { isFillable: lockReasons.length === 0, lockReasons };
}

export function evaluateStructuralLock(input: {
  date: string;
  today: string;
  timesheetStatus: TimesheetStatus | null;
  bypassPastWindow?: boolean;
}): { locked: boolean; lockReasons: LockReason[] } {
  const lockReasons: LockReason[] = [];
  applyEntryWindow(lockReasons, {
    date: input.date,
    today: input.today,
    isHoliday: false,
    isOnApprovedLeave: false,
    timesheetStatus: input.timesheetStatus,
    bypassPastWindow: input.bypassPastWindow,
  });
  if (input.timesheetStatus === 'submitted') lockReasons.push('pending_approval');
  if (input.timesheetStatus === 'approved') lockReasons.push('approved');
  return { locked: lockReasons.length > 0, lockReasons };
}

export function describeEntryWindow(today: string, timeZone: string) {
  const bounds = entryWindowBounds(today);
  return {
    timezone: timeZone,
    today,
    yesterday: bounds.openFrom,
    openFrom: bounds.openFrom,
    openThrough: bounds.openThrough,
    message: ENTRY_WINDOW_NOTICE,
  };
}

export function lockMessage(reasons: readonly LockReason[]): string {
  if (reasons.length === 0) return 'This date cannot be filled.';
  return reasons.map((reason) => LOCK_MESSAGES[reason]).join(' ');
}
