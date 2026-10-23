export function localDate(at, timeZone) {
  const parts = new Intl.DateTimeFormat('en', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(at);
  const part = type => parts.find(p => p.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

const iso = date => date.toISOString().slice(0, 10);
export function period(date, unit) {
  const d = new Date(`${date}T00:00:00Z`);
  if (unit === 'month') {
    const y = d.getUTCFullYear(), m = d.getUTCMonth();
    return { start: iso(new Date(Date.UTC(y, m, 1))), end: iso(new Date(Date.UTC(y, m + 1, 1))), previous: iso(new Date(Date.UTC(y, m - 1, 1))) };
  }
  if (unit !== 'week') throw new Error('Invalid period');
  d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7);
  const start = iso(d);
  d.setUTCDate(d.getUTCDate() + 7);
  const end = iso(d);
  d.setUTCDate(d.getUTCDate() - 14);
  return { start, end, previous: iso(d) };
}
