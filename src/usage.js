import { localDate } from './calendar.js';

const isCount = n => Number.isSafeInteger(n) && n >= 0;
export function safeAdd(a, b) {
  const sum = a + b;
  if (!Number.isSafeInteger(sum)) throw new Error('Token count overflow');
  return sum;
}

function totalUsage(u) {
  for (const key of ['inputTokens', 'outputTokens', 'cacheReadTokens', 'cacheWriteTokens', 'reasoningTokens', 'totalTokens']) {
    if ((key === 'inputTokens' || key === 'outputTokens' || u[key] !== undefined) && !isCount(u[key])) throw new Error('Invalid usage count');
  }
  if ((u.reasoningTokens ?? 0) > u.outputTokens) throw new Error('Invalid reasoning usage');
  const known = [u.inputTokens, u.outputTokens, u.cacheReadTokens ?? 0, u.cacheWriteTokens ?? 0].reduce(safeAdd, 0);
  if (u.totalTokens !== undefined && (u.totalTokens < known || (u.cacheReadTokens !== undefined && u.cacheWriteTokens !== undefined && u.totalTokens !== known))) throw new Error('Inconsistent usage total');
  return u.totalTokens ?? known;
}

export function foldUsage(events, { timeZone, inheritedEventCount = 0 }) {
  const daily = {};
  let last;
  const add = (day, amount) => {
    daily[day] = safeAdd(daily[day] ?? 0, amount);
    if (daily[day] === 0) delete daily[day];
  };
  for (const [index, event] of events.entries()) {
    const { type, data } = event;
    if (type === 'llm/retry-started') {
      if (last?.turn === data.turn && last.step === data.step) last = undefined;
      continue;
    }
    if (type !== 'assistant/message' && type !== 'assistant/attempt') continue;
    const u = type === 'assistant/message' && data.usage !== undefined ? data.usage : data.stream?.findLast(r => r.type === 'chunk' && r.chunk?.type === 'usage')?.chunk.usage;
    if (!u) continue;
    const n = totalUsage(u);
    if (!Number.isFinite(event.time) || !isCount(data.turn) || !isCount(data.step)) throw new Error('Invalid usage event');
    const day = localDate(event.time, timeZone);
    const signature = JSON.stringify([u.inputTokens, u.outputTokens, u.cacheReadTokens ?? 0, u.cacheWriteTokens ?? 0, u.totalTokens]);
    const previous = last?.turn === data.turn && last.step === data.step ? last : undefined;
    if (previous?.signature === signature) continue;
    const baseline = index < inheritedEventCount ? n : (previous?.baseline ?? 0);
    const contribution = index < inheritedEventCount ? 0 : Math.max(0, n - baseline);
    if (previous) add(previous.day, -previous.contribution);
    add(day, contribution);
    last = { turn: data.turn, step: data.step, day, n, signature, baseline, contribution };
  }
  return daily;
}
