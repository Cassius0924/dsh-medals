import test from 'node:test';
import assert from 'node:assert/strict';
import * as calendar from '../src/calendar.js';

test('usage dates use the fixed timezone rather than the UTC date', () => {
  assert.equal(calendar.localDate?.(Date.parse('2026-10-18T16:01:00Z'), 'Asia/Shanghai'), '2026-10-19');
});

test('natural periods handle Sunday, leap-month and preceding periods', () => {
  assert.deepEqual(calendar.period?.('2024-03-03', 'week'), { start: '2024-02-26', end: '2024-03-04', previous: '2024-02-19' });
  assert.deepEqual(calendar.period?.('2024-02-29', 'month'), { start: '2024-02-01', end: '2024-03-01', previous: '2024-01-01' });
});
