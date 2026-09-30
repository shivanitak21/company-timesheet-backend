import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { summarizeEntries } from './totals';

describe('totals', () => {
  it('sums daily, weekly, and monthly minutes', () => {
    const summary = summarizeEntries([
      { date: '2026-09-28', durationMinutes: 60 },
      { date: '2026-09-29', durationMinutes: 90 },
      { date: '2026-09-29', durationMinutes: 30 },
    ]);
    assert.deepEqual(summary.dailyTotals, [
      { date: '2026-09-28', totalMinutes: 60 },
      { date: '2026-09-29', totalMinutes: 120 },
    ]);
    assert.equal(summary.weeklyTotals[0]?.weekStart, '2026-09-28');
    assert.equal(summary.weeklyTotals[0]?.totalMinutes, 180);
    assert.equal(summary.monthlyTotalMinutes, 180);
  });
});
