import test from 'node:test';
import assert from 'node:assert/strict';
import * as usage from '../src/usage.js';
const event = (type, tokens, date = '2026-10-19', turn = 1) => ({ type, time: Date.parse(`${date}T04:00:00Z`), data: { turn, step: 0, usage: tokens } });
const u = n => ({ inputTokens: n, outputTokens: 2, cacheReadTokens: 3, cacheWriteTokens: 4, reasoningTokens: 1 });

test('billed usage includes caches but counts reasoning only inside output', () => {
  assert.deepEqual(usage.foldUsage?.([event('assistant/message', u(10))], { timeZone: 'Asia/Shanghai' }), { '2026-10-19': 19 });
});

test('attempt stream samples are replaced by the final same-slot message, retries remain billed', () => {
  const attempt = event('assistant/attempt', undefined);
  attempt.data.stream = [{type:'chunk', chunk:{type:'usage', usage:u(2)}}, {type:'chunk', chunk:{type:'usage', usage:u(10)}}];
  assert.deepEqual(usage.foldUsage([attempt, event('assistant/message', u(20), '2026-10-20'), event('assistant/message', u(20), '2026-10-20'), event('llm/retry-started'), event('assistant/message', u(5), '2026-10-20')], {timeZone:'Asia/Shanghai'}), {'2026-10-20':43});
});

test('fork inheritance is excluded, while new own requests and corrections contribute', () => {
  const events = [event('assistant/message', u(10)), event('assistant/message', u(10)), event('assistant/message', u(20), '2026-10-20'), event('assistant/message', u(4), '2026-10-20', 2)];
  assert.deepEqual(usage.foldUsage(events, {timeZone:'Asia/Shanghai', inheritedEventCount:1}), {'2026-10-20':23});
});

test('reported exact totals are respected; invalid and overflowing counts block the scan', () => {
  assert.deepEqual(usage.foldUsage([event('assistant/message', {inputTokens:10, outputTokens:2, totalTokens:25})], {timeZone:'UTC'}), {'2026-10-19':25});
  for (const invalid of [u(-1), {...u(10), reasoningTokens:3}, {...u(10), totalTokens:99}, u(Number.MAX_SAFE_INTEGER)]) {
    assert.throws(() => usage.foldUsage([event('assistant/message', invalid)], {timeZone:'UTC'}), /usage|overflow/i);
  }
});
