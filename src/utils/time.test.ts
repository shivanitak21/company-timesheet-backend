import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { durationMinutes, rangesOverlap, timeToMinutes } from './time';

describe('time ranges', () => {
  it('treats touching ranges as valid and overlaps as invalid', () => {
    assert.equal(rangesOverlap(timeToMinutes('09:00'), timeToMinutes('10:00'), timeToMinutes('10:00'), timeToMinutes('11:00')), false);
    assert.equal(rangesOverlap(timeToMinutes('09:00'), timeToMinutes('10:30'), timeToMinutes('10:00'), timeToMinutes('11:00')), true);
  });

  it('rejects zero or reverse durations', () => {
    assert.equal(durationMinutes('09:00', '12:30'), 210);
    assert.equal(durationMinutes('17:00', '09:00'), null);
    assert.equal(durationMinutes('09:00', '09:00'), null);
  });
});
