import test from 'node:test';
import assert from 'node:assert/strict';
import * as challenges from '../src/challenges.js';
import {RULES} from '../src/awards.js';

test('classic sculpted medals remain earnable at their original absolute and growth thresholds', () => {
  const pairs=[['volume-week','orbit'],['growth-week','rise'],['growth-month','dawn'],['tokens-100M','first'],['tokens-500M','beyond']];
  for(const [id,design] of pairs){
    const current=challenges.CHALLENGES.find(r=>r.id===id),classic=RULES.find(r=>r.id===design);
    assert.equal(current.design,design);
    assert.equal(current.name,classic.name);
    assert.equal(current.metal,classic.metal);
    if(classic.growth){assert.equal(current.growth,classic.growth);assert.equal(current.minimum,classic.minimum);}
    else assert.equal(current.target,classic.target);
  }
  assert(challenges.CHALLENGES.filter(r=>r.series==='daily'||r.series==='weekly').every(r=>r.design==='numeric'));
  assert(challenges.CHALLENGES.filter(r=>r.series==='tokens').every(r=>r.design!=='numeric'));
});

test('daily collection starts on activation and awards fixed tiers', () => {
  assert.equal(typeof challenges.createChallenges,'function');
  const state=challenges.createChallenges('2026-10-23');
  const result=challenges.settleChallenges({'2026-10-22':100e6,'2026-10-23':10e6},state,{today:'2026-10-23',backfill:true});
  assert.deepEqual(result.awards.filter(a=>a.ruleId.startsWith('daily-')).map(a=>[a.ruleId,a.period]),[['daily-1','2026-10-23'],['daily-2','2026-10-23']]);
  assert.deepEqual(result.completedDays,['2026-10-23']);
});

test('daily thresholds are fixed and identical for every challenge state',()=>{
 const targets=challenges.CHALLENGES.filter(r=>r.unit==='day').map(r=>r.target);
 assert.deepEqual(targets,[5e6,10e6,20e6]);
 for(const start of ['2026-10-19','2026-10-23']){
  const state=challenges.createChallenges(start),daily={[start]:10e6};
  const settled=challenges.settleChallenges(daily,state,{today:start});
  assert.deepEqual(settled.awards.filter(a=>a.ruleId.startsWith('daily-')).map(a=>a.ruleId),['daily-1','daily-2']);
 }
});

test('every sculptural challenge owns its motif',()=>{
 const motifs=challenges.CHALLENGES.filter(r=>r.design!=='numeric').map(r=>r.design);
 assert.equal(new Set(motifs).size,motifs.length);
});

test('weekly consistency requires fixed daily usage and closes perfect weeks', () => {
  const state=challenges.createChallenges('2026-10-19'),daily={};
  for(let day=19;day<=25;day++)daily[`2026-10-${day}`]=5e6;
  const open=challenges.settleChallenges(daily,state,{today:'2026-10-25'});
  assert.deepEqual(open.awards.filter(a=>a.ruleId.startsWith('week-days')).map(a=>a.ruleId),['week-days-3','week-days-5']);
  const closed=challenges.settleChallenges(daily,open,{today:'2026-10-26'});
  assert.equal(closed.awards.find(a=>a.ruleId==='week-days-7')?.earnedOn,'2026-10-26');
  assert.equal(closed.awards.filter(a=>a.ruleId==='days-7').length,1);
  assert.equal(challenges.settleChallenges({},closed,{today:'2026-11-01'}).awards.length,closed.awards.length);
});

test('monthly consistency handles leap months and absolute usage backfills', () => {
  const state=challenges.createChallenges('2024-02-01'),daily={};
  for(let day=1;day<=29;day++)daily[`2024-02-${String(day).padStart(2,'0')}`]=5e6;
  const all=challenges.settleChallenges(daily,state,{today:'2024-03-01',backfill:true});
  assert.deepEqual(all.awards.filter(a=>a.ruleId.startsWith('month-days')).map(a=>a.ruleId),['month-days-10','month-days-20','month-days-all']);
  assert.equal(all.awards.find(a=>a.ruleId==='month-days-all').earnedOn,'2024-03-01');
  const history=challenges.settleChallenges({'2026-08-14':600e6},challenges.createChallenges('2026-10-23'),{today:'2026-10-23',backfill:true});
  assert.equal(history.completedDays.length,0);
  assert.deepEqual(history.awards.filter(a=>a.ruleId.startsWith('tokens-')).map(a=>a.ruleId),['tokens-100M','tokens-500M']);
  assert.deepEqual(history.awards.filter(a=>a.ruleId.startsWith('volume-')).map(a=>a.ruleId),['volume-week','volume-month','volume-month-500M']);
  assert.equal(challenges.CHALLENGES.length,25);
});

test('growth awards close complete periods only, enforce basis, and are idempotent', () => {
  const state=challenges.createChallenges('2026-10-23'), daily={'2026-10-05':5e6,'2026-10-12':10e6,'2026-10-19':30e6,'2026-09-01':20e6,'2026-10-01':60e6};
  const first=challenges.settleChallenges(daily,state,{today:'2026-10-25'});
  assert.deepEqual(first.awards.filter(a=>a.ruleId==='growth-week').map(a=>a.period),['2026-10-12']);
  const next=challenges.settleChallenges(daily,first,{today:'2026-11-01'});
  assert.equal(next.awards.find(a=>a.ruleId==='growth-month')?.earnedOn,'2026-11-01');
  assert.equal(challenges.settleChallenges(daily,next,{today:'2026-11-01'}).awards.length,next.awards.length);
});

test('progress publishes fixed thresholds and ineligible growth', () => {
  const state=challenges.settleChallenges({'2026-10-23':3e6},challenges.createChallenges('2026-10-23'),{today:'2026-10-23'});
  assert.equal(typeof challenges.challengeProgress,'function');
  const progress=challenges.challengeProgress({'2026-10-23':3e6},state,'2026-10-23');
  assert.deepEqual([progress['daily-1'].current,progress['daily-1'].target],[3e6,5e6]);
  assert.equal(progress['growth-week'].eligible,false);
  assert.equal(progress['week-days-3'].current,0);
});

test('monthly usage keeps 月面漫游 at 200M and adds three larger tiers',()=>{
  const monthly=challenges.CHALLENGES.filter(r=>r.series==='monthlyVolume');
  assert.deepEqual(monthly.map(r=>[r.id,r.name,r.target]),[['volume-month','月面漫游',200e6],['volume-month-500M','蔚蓝家园',500e6],['volume-month-1B','日冕之光',1e9],['volume-month-3B','行星巡礼',3e9]]);
  assert(monthly.every(r=>r.unit==='month'&&r.metric==='tokens'));
});

test('tiers added after install backfill closed months quietly and reveal only the current month',()=>{
  // A ledger written before knownRules existed already settled the original 22 rules.
  const before=challenges.settleChallenges({'2026-08-14':600e6},challenges.createChallenges('2026-08-01'),{today:'2026-08-20',backfill:true});
  const legacy={...before,awards:before.awards.filter(a=>!a.ruleId.startsWith('volume-month-')),knownRules:undefined};
  const after=challenges.settleChallenges({'2026-08-14':600e6,'2026-10-20':1.2e9},legacy,{today:'2026-10-24'});
  const august=after.awards.find(a=>a.id==='volume-month-500M:2026-08-01'),october=after.awards.find(a=>a.id==='volume-month-1B:2026-10-01');
  assert.equal(august.seen,true);assert.equal(august.backfilled,true);
  assert.equal(october.seen,false);assert.equal(october.backfilled,false);
  assert.equal(after.knownRules.length,25);
  // Once known, a later closed-month award for an existing rule is revealed normally.
  const next=challenges.settleChallenges({'2026-08-14':600e6,'2026-10-20':1.2e9,'2026-09-03':250e6},after,{today:'2026-10-24'});
  assert.equal(next.awards.find(a=>a.id==='volume-month:2026-09-01').seen,false);
});
