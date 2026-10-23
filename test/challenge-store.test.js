import {tmpdir} from 'node:os';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {Ledger} from '../src/store.js';
import {createChallenges,settleChallenges} from '../src/challenges.js';

test('challenge state rejects invalid completed-day records',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'challenges-store-')),path=join(dir,'ledger.json');
 try {
  const ledger=new Ledger(path,'UTC');
  await ledger.update(s=>{s.challenges=settleChallenges({'2026-10-23':5e6},createChallenges('2026-10-23'),{today:'2026-10-23'});});
  const valid=await readFile(path,'utf8');
  const broken=JSON.parse(valid);broken.challenges.completedDays.push('invalid-date');await writeFile(path,JSON.stringify(broken));
  await assert.rejects(ledger.update(()=>{}),/challenge/i);assert.equal(await readFile(path,'utf8'),JSON.stringify(broken));
 }finally{await rm(dir,{recursive:true,force:true});}
});
