import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { addDays, diffDays, daysInMonth, isPreviousMonth, isWeekendDate, isoWeekStart, weekdayIndex } from './dates';

describe('dates', () => {
  it('knows 29 Sep 2026 is a Tuesday', () => {
    assert.equal(weekdayIndex('2026-09-29'), 2);
    assert.equal(isWeekendDate('2026-09-26'), true);
    assert.equal(isWeekendDate('2026-09-27'), true);
    assert.equal(isWeekendDate('2026-09-29'), false);
  });

  it('compares months and spans weeks from Monday', () => {
    assert.equal(isPreviousMonth('2026-08-31', '2026-09-29'), true);
    assert.equal(isPreviousMonth('2026-09-01', '2026-09-29'), false);
    assert.equal(isoWeekStart('2026-09-29'), '2026-09-28');
    assert.equal(addDays('2026-09-30', 1), '2026-10-01');
    assert.equal(diffDays('2026-09-01', '2026-09-30'), 29);
  });

  it('counts September and leap February', () => {
    assert.equal(daysInMonth(2026, 9).length, 30);
    assert.equal(daysInMonth(2024, 2).length, 29);
    assert.equal(daysInMonth(2026, 2).at(-1), '2026-02-28');
  });
});
