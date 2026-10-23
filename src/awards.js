import { period } from './calendar.js';
import { safeAdd } from './usage.js';

export const RULES = [
  {id:'orbit', name:'恒星轨道', family:'period', metal:'gold', unit:'week', target:50e6, inscription:'把每一次探索，汇成自己的轨道'},
  {id:'lunar', name:'月面漫游', family:'period', metal:'silver', unit:'month', target:200e6, inscription:'每一小步，都留下一点光'},
  {id:'rise', name:'向上生长', family:'growth', metal:'silver', unit:'week', growth:1, minimum:5e6, inscription:'比昨天，再向前一点'},
  {id:'dawn', name:'破晓之势', family:'growth', metal:'gold', unit:'month', growth:2, minimum:20e6, inscription:'让持续的生长，迎来新的黎明'},
  {id:'first', name:'里程初章', family:'lifetime', metal:'gold', target:100e6, inscription:'每一份积累，都算数'},
  {id:'beyond', name:'无尽远行', family:'lifetime', metal:'silver', target:500e6, inscription:'远行从未停止'},
];

export function settle(daily, existing, {today, backfill = false}) {
  const awards = [...existing];
  const ids = new Set(awards.map(a=>a.id));
  const dates = Object.keys(daily).filter(d=>d <= today).sort();
  for (const rule of RULES) {
    const totals = new Map();
    for (const date of dates) {
      const p = rule.family === 'lifetime' ? {start:'lifetime', end:null} : period(date, rule.unit);
      const n = safeAdd(totals.get(p.start) ?? 0, daily[date]);
      totals.set(p.start,n);
      const id = `${rule.id}:${p.start}`;
      if (rule.family !== 'growth' && n >= rule.target && !ids.has(id)) {
        ids.add(id);
        awards.push({id, ruleId:rule.id, period:p.start, end:p.end, earnedOn:date, tokens:n, serial:String(awards.length+1).padStart(6,'0'), seen:backfill, backfilled:backfill});
      }
    }
    if (rule.family === 'growth') {
      for (const [start, n] of totals) {
        const p = period(start, rule.unit);
        const previous = totals.get(p.previous) ?? 0;
        const id = `${rule.id}:${start}`;
        if (p.end > today || previous < rule.minimum || BigInt(n) < BigInt(previous) * BigInt(1 + rule.growth) || ids.has(id)) continue;
        ids.add(id);
        awards.push({id, ruleId:rule.id, period:start, end:p.end, earnedOn:p.end, tokens:n, previous, serial:String(awards.length+1).padStart(6,'0'), seen:backfill, backfilled:backfill});
      }
    }
  }
  return awards;
}
