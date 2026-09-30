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
});
