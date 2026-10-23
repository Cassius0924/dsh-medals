import {tmpdir} from 'node:os';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {Ledger} from '../src/store.js';
import * as services from '../src/service.js';
const message=n=>({type:'assistant/message',time:Date.parse('2026-10-19T04:00:00Z'),data:{turn:1,step:0,usage:{inputTokens:n,outputTokens:0}}});

test('real persistence scan backfills once, skips unchanged logs, and retains deleted-session awards', async () => {
  const dir=await mkdtemp(join(tmpdir(),'medals-service-'));
  let events=[message(60e6)], reads=0, present=true;
  const persistence={list:async()=>present?[{header:{id:'s1'},revision:'r1'}]:[], open:async()=>({inheritedEventCount:0,read:async(offset)=>{reads++;return{events:offset?[]:events};},close:async()=>{}})};
  try {
    assert.equal(typeof services.MedalsService,'function');
    const service=new services.MedalsService({persistence,ledger:new Ledger(join(dir,'ledger.json'),'Asia/Shanghai'),clock:()=>Date.parse('2026-10-20T00:00:00Z')});
    const first=await service.refresh();
    assert.equal(first.total,60e6); assert.equal(first.challenges.awards.length,1); assert.equal(first.challenges.unseen.length,0);
    const readCount=reads;
    await service.refresh();assert.equal(reads,readCount);
    present=false;
    const after=await service.refresh();assert.equal(after.total,60e6);assert.equal(after.challenges.awards.length,1);assert.equal(after.archivedSessions,1);
  } finally {await rm(dir,{recursive:true,force:true});}
});

test('a partial scan cannot issue awards, restart rescans revisions, and acknowledgements persist', async () => {
  const dir=await mkdtemp(join(tmpdir(),'medals-failure-'));
  let revision='r1', n=1e6, fail=false;
  const persistence={list:async()=>[{header:{id:'s1'},revision},{header:{id:'s2'},revision}],open:async id=>{
    if(fail&&id==='s2')throw new Error('read failed');
    return {inheritedEventCount:0,read:async offset=>({events:offset?[]:[message(n)]}),close:async()=>{}};
  }};
  try {
    const options={persistence,ledger:new Ledger(join(dir,'ledger.json'),'UTC'),clock:()=>Date.parse('2026-10-20')};
    const service=new services.MedalsService(options);await service.refresh();
    n=30e6;revision='r2';fail=true;
    const partial=await service.refresh();assert.equal(partial.complete,false);assert.equal(partial.challenges.awards.length,0);
    fail=false;
    const next=await service.refresh();assert.equal(next.challenges.awards.length,1);assert.equal(next.challenges.unseen.length,1);
    await service.acknowledgeChallenges(next.challenges.unseen);
    n=40e6;
    const restarted=await new services.MedalsService(options).refresh();assert.equal(restarted.total,80e6);assert.equal(restarted.challenges.unseen.length,0);
  } finally {await rm(dir,{recursive:true,force:true});}
});

test('format refusals are transparently excluded from readable-session accounting', async () => {
  const dir=await mkdtemp(join(tmpdir(),'medals-format-'));
  const persistence={list:async()=>[{header:{id:'good'},revision:'g'},{header:{id:'legacy'},revision:'l'}],open:async id=>{
    if(id==='legacy')throw Object.assign(new Error('unsupported format'),{name:'SessionFormatUnsupportedError'});
    return{inheritedEventCount:0,read:async offset=>({events:offset?[]:[message(60e6)]}),close:async()=>{}};
  }};
  try {
    const s=await new services.MedalsService({persistence,ledger:new Ledger(join(dir,'ledger.json'),'UTC'),clock:()=>Date.parse('2026-10-20')}).refresh();
    assert.equal(s.complete,true);assert.equal(s.excludedSessions,1);assert.equal(s.sessionCount,1);assert.equal(s.challenges.awards.length,1);
  } finally {await rm(dir,{recursive:true,force:true});}
});

test('service publishes persistent fixed challenge criteria',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'medals-fixed-'));
 try{
  const options={ledger:new Ledger(join(dir,'ledger.json'),'UTC'),persistence:{list:async()=>[]},clock:()=>Date.parse('2026-10-23')};
  for(const service of [new services.MedalsService(options),new services.MedalsService(options)]){
   const snapshot=await service.refresh();assert.equal(snapshot.challenges.dailyTarget,5e6);
   assert.deepEqual(snapshot.challenges.rules.filter(r=>r.unit==='day').map(r=>r.target),[5e6,10e6,20e6]);
  }
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('a committed acknowledgement survives unavailable follow-up synchronization',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'medals-saved-ack-'));let fail=false;
 try{
  const path=join(dir,'ledger.json'),ledger=new Ledger(path,'UTC');
  const persistence={list:async()=>{if(fail)throw new Error('list failed');return[{header:{id:'s1'},revision:1}];},open:async()=>({inheritedEventCount:0,read:async offset=>({events:offset?[]:[message(60e6)]}),close:async()=>{}})};
  const service=new services.MedalsService({ledger,persistence,clock:()=>Date.parse('2026-10-23')});
  const before=await service.refresh(),id=before.challenges.awards[0].id;
  await ledger.update(s=>{s.challenges.awards[0].seen=false;});fail=true;
  const result=await service.acknowledgeChallenges([id]);
  assert.equal(result.complete,false);assert.match(result.error,/已保存.*同步失败/);
  assert.equal(result.challenges.awards.find(a=>a.id===id).seen,true);
  assert.equal(JSON.parse(await readFile(path,'utf8')).challenges.awards.find(a=>a.id===id).seen,true);
  assert.equal(result.total,before.total);assert.equal(result.updatedAt,before.updatedAt);
  await assert.rejects(service.acknowledgeChallenges(['unknown']));
  fail=false;assert.equal((await service.refresh()).complete,true);
 }finally{await rm(dir,{recursive:true,force:true});}
});
