import test from 'node:test';
import assert from 'node:assert/strict';
import * as awards from '../src/awards.js';

test('weekly volume awards the exact crossing day once per natural week', () => {
  const result = awards.settle?.({'2026-10-18':60e6, '2026-10-19':30e6, '2026-10-20':20e6}, [], {today:'2026-10-20', backfill:true});
  assert.deepEqual(result?.filter(a=>a.ruleId==='orbit').map(a=>[a.id,a.earnedOn,a.seen]), [['orbit:2026-10-12','2026-10-18',true], ['orbit:2026-10-19','2026-10-20',true]]);
});

test('monthly and lifetime tiers are independent, idempotent, and never revoked', () => {
  const daily = {'2026-09-30':210e6,'2026-10-01':300e6};
  const result = awards.settle(daily, [], {today:'2026-10-01'});
  assert.deepEqual(result.filter(a=>a.ruleId==='lunar').map(a=>a.period), ['2026-09-01','2026-10-01']);
  assert.deepEqual(result.filter(a=>['first','beyond'].includes(a.ruleId)).map(a=>[a.ruleId,a.earnedOn]), [['first','2026-09-30'],['beyond','2026-10-01']]);
  assert.deepEqual(awards.settle({},result,{today:'2026-11-01'}),result);
  assert.deepEqual(awards.settle(daily,result,{today:'2026-10-01'}),result);
});

test('growth waits for closure and rejects zero or insufficient previous basis', () => {
  const daily = {'2026-10-05':5e6,'2026-10-12':10e6,'2026-10-19':30e6,'2026-09-01':20e6,'2026-10-01':60e6};
  const open = awards.settle(daily,[],{today:'2026-10-25'}).filter(a=>a.ruleId==='rise');
  assert.deepEqual(open.map(a=>[a.period,a.earnedOn]), [['2026-10-12','2026-10-19']]);
  const closed = awards.settle(daily,[],{today:'2026-11-01'});
  assert.equal(closed.find(a=>a.ruleId==='dawn')?.earnedOn,'2026-11-01');
  assert.equal(awards.settle({'2026-10-05':4e6,'2026-10-12':100e6},[],{today:'2026-10-19'}).some(a=>a.ruleId==='rise'),false);
});
