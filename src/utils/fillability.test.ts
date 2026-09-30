import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { evaluateFillability, evaluateStructuralLock } from './fillability';

const today = '2026-09-29';

describe('fillability', () => {
  it('allows a current weekday that is not a holiday or leave', () => {
    const result = evaluateFillability({
      date: '2026-09-29',
      today,
      isHoliday: false,
      isOnApprovedLeave: false,
      timesheetStatus: 'draft',
    });
    assert.equal(result.isFillable, true);
    assert.deepEqual(result.lockReasons, []);
  });

  it('locks weekends, holidays, leave, future dates, and previous months', () => {
    assert.ok(evaluateFillability({ date: '2026-09-26', today, isHoliday: false, isOnApprovedLeave: false, timesheetStatus: null }).lockReasons.includes('weekend'));
    assert.ok(evaluateFillability({ date: '2026-09-29', today, isHoliday: true, isOnApprovedLeave: false, timesheetStatus: 'draft' }).lockReasons.includes('holiday'));
    assert.ok(evaluateFillability({ date: '2026-09-29', today, isHoliday: false, isOnApprovedLeave: true, timesheetStatus: 'draft' }).lockReasons.includes('leave'));
    assert.ok(evaluateFillability({ date: '2026-09-30', today, isHoliday: false, isOnApprovedLeave: false, timesheetStatus: null }).lockReasons.includes('future'));
    assert.ok(evaluateFillability({ date: '2026-08-31', today, isHoliday: false, isOnApprovedLeave: false, timesheetStatus: 'draft' }).lockReasons.includes('previous_month'));
  });

  it('locks submitted and approved timesheets but allows rejected drafts to be edited', () => {
    assert.deepEqual(
      evaluateFillability({ date: '2026-09-29', today, isHoliday: false, isOnApprovedLeave: false, timesheetStatus: 'submitted' }).lockReasons,
      ['pending_approval'],
    );
    assert.deepEqual(
      evaluateFillability({ date: '2026-09-29', today, isHoliday: false, isOnApprovedLeave: false, timesheetStatus: 'approved' }).lockReasons,
      ['approved'],
    );
    assert.equal(
      evaluateFillability({ date: '2026-09-29', today, isHoliday: false, isOnApprovedLeave: false, timesheetStatus: 'rejected' }).isFillable,
      true,
    );
  });

  it('lets an existing entry be removed when only the day type changed', () => {
    const structural = evaluateStructuralLock({ date: '2026-09-29', today, timesheetStatus: 'draft' });
    assert.equal(structural.locked, false);
    const approved = evaluateStructuralLock({ date: '2026-09-29', today, timesheetStatus: 'approved' });
    assert.equal(approved.locked, true);
  });

  it('opens only today and yesterday in the company calendar', () => {
    const sept30 = '2026-09-30';
    const open = (date: string, todayDate: string, bypassPastWindow = false) =>
      evaluateFillability({ date, today: todayDate, isHoliday: false, isOnApprovedLeave: false, timesheetStatus: 'draft', bypassPastWindow });

    assert.equal(open('2026-09-30', sept30).isFillable, true);
    assert.equal(open('2026-09-29', sept30).isFillable, true);
    assert.ok(open('2026-09-28', sept30).lockReasons.includes('entry_window'));
    assert.ok(open('2026-10-01', sept30).lockReasons.includes('entry_window'));
    assert.ok(open('2026-10-01', sept30).lockReasons.includes('future'));

    const oct1 = '2026-10-01';
    assert.equal(open('2026-10-01', oct1).isFillable, true);
    assert.equal(open('2026-09-30', oct1).isFillable, true);
    assert.equal(open('2026-09-30', oct1).lockReasons.includes('previous_month'), false);
    assert.ok(open('2026-09-29', oct1).lockReasons.includes('entry_window'));
    assert.ok(open('2026-10-02', oct1).lockReasons.includes('entry_window'));

    const bypassed = open('2026-09-28', sept30, true);
    assert.equal(bypassed.lockReasons.includes('entry_window'), false);
    assert.ok(open('2026-10-01', sept30, true).lockReasons.includes('entry_window'));
  });
});
