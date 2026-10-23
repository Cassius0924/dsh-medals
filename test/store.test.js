import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import * as store from '../src/store.js';
import {settle} from '../src/awards.js';

const validAwards=()=>settle({'2026-09-01':20e6,'2026-10-05':5e6,'2026-10-12':10e6,'2026-10-19':600e6},[],{today:'2026-11-01'});
const validLedger=()=>({version:1,timeZone:'UTC',initialized:true,sessions:{s1:{daily:{'2026-10-19':600e6}}},awards:validAwards()});

test('ledger transactions serialize writers and preserve permanent awards across restart', async () => {
  const dir = await mkdtemp(join(process.env.TMPDIR,'medals-store-'));
  try {
    const path=join(dir,'ledger.json');
    assert.equal(typeof store.Ledger,'function');
    const a=new store.Ledger(path,'Asia/Shanghai'), b=new store.Ledger(path,'UTC');
    await a.update(()=>{});
    const awards=validAwards();
    await Promise.all([a.update(s=>{s.awards.push(awards.find(a=>a.ruleId==='first'));}),b.update(s=>{s.awards.push(awards.find(a=>a.ruleId==='beyond'));})]);
    const saved=JSON.parse(await readFile(path,'utf8'));
    assert.equal(saved.awards.length,2);
    assert.equal(saved.timeZone,'Asia/Shanghai');
    await writeFile(path,'corrupt');
    await assert.rejects(a.update(()=>{}), /ledger|JSON/i);
    assert.equal(await readFile(path,'utf8'),'corrupt');
  } finally {await rm(dir,{recursive:true,force:true});}
});

test('ledger rejects malformed persisted awards without invoking changes or overwriting the file', async () => {
  const dir=await mkdtemp(join(process.env.TMPDIR,'medals-invalid-awards-'));
  const path=join(dir,'ledger.json');
  try {
    const ledger=new store.Ledger(path,'UTC');
    const valid=validLedger();
    await writeFile(path,JSON.stringify(valid));
    await ledger.update(()=>{});
    assert.deepEqual(JSON.parse(await readFile(path,'utf8')),valid);
    const mutations=[
      state=>{state.awards=[{id:'first:lifetime'}];},
      ...['ruleId','period','end','earnedOn','tokens','serial','seen','backfilled'].map(key=>state=>{delete state.awards[0][key];}),
      state=>{state.awards[0]=null;},
      state=>{state.awards[0].ruleId='unknown';},
      state=>{state.awards[0].id='wrong:id';},
      state=>{state.awards[0].period='2026-10-32';},
      state=>{state.awards[0].end='2026-12-01';},
      state=>{state.awards[0].earnedOn='2026-02-30';},
      state=>{state.awards[0].tokens=-1;},
      state=>{state.awards[0].serial=1;},
      state=>{state.awards[0].seen='false';},
      state=>{state.awards[0].backfilled=0;},
      state=>{delete state.awards.find(a=>a.ruleId==='rise').previous;},
      state=>{state.awards.find(a=>a.ruleId==='rise').previous=Number.MAX_SAFE_INTEGER+1;},
      state=>{state.awards.push({...state.awards[0]});},
    ];
    for (const [index,mutate] of mutations.entries()) {
      const state=validLedger();mutate(state);
      const original=JSON.stringify(state,null,2);
      await writeFile(path,original);
      let called=false;
      await assert.rejects(ledger.update(()=>{called=true;}),/Invalid medals ledger/,`mutation ${index}`);
      assert.equal(called,false,`mutation ${index} invoked the writer`);
      assert.equal(await readFile(path,'utf8'),original,`mutation ${index} overwrote the ledger`);
    }
  } finally {await rm(dir,{recursive:true,force:true});}
});

test('ledger rejects malformed persisted usage and ledger shapes without erasing usage', async () => {
  const dir=await mkdtemp(join(process.env.TMPDIR,'medals-invalid-usage-'));
  const path=join(dir,'ledger.json');
  try {
    const ledger=new store.Ledger(path,'UTC');
    const mutations=[
      state=>{state.sessions.s1.daily=123;},
      state=>{state.sessions.s1.daily=[];},
      state=>{state.sessions.s1.daily='';},
      state=>{state.sessions.s1.daily=null;},
      state=>{state.sessions.s1=null;},
      state=>{state.sessions.s1=[];},
      state=>{state.sessions.s1={};},
      state=>{state.sessions.s1.daily={'2026-02-30':1};},
      state=>{state.sessions.s1.daily={'2026-10-19':-1};},
      state=>{state.sessions.s1.daily={'2026-10-19':1.5};},
      state=>{state.sessions.s1.daily={'2026-10-19':'1'};},
      state=>{state.sessions.s1.daily={'2026-10-19':Number.MAX_SAFE_INTEGER+1};},
      state=>{state.sessions.constructor={daily:{}};},
      state=>{state.sessions['']={daily:{}};},
      state=>{delete state.initialized;},
      state=>{state.initialized='false';},
      state=>{state.sessions=[];},
      state=>{state.timeZone='not/a-zone';},
      state=>{state.version=2;},
    ];
    for (const [index,mutate] of mutations.entries()) {
      const state=validLedger();mutate(state);
      const original=JSON.stringify(state,null,2);
      await writeFile(path,original);
      let called=false;
      await assert.rejects(ledger.update(()=>{called=true;}),/Invalid medals ledger/,`mutation ${index}`);
      assert.equal(called,false,`mutation ${index} invoked the writer`);
      assert.equal(await readFile(path,'utf8'),original,`mutation ${index} overwrote the ledger`);
    }
  } finally {await rm(dir,{recursive:true,force:true});}
});
