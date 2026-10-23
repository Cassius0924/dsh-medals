import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import * as plugin from '../src/index.js';

test('host registers a plugin-owned route and releases it on disposal', async () => {
  assert.deepEqual(plugin.inject,['webServer','sessionPersistence','connection']);
  const dir=await mkdtemp(join(process.env.TMPDIR,'medals-plugin-'));
  const cleanup=[];let registered=0;
  const ctx={connection:{admit:()=>({peer:{}})},sessionPersistence:{list:async()=>[]},webServer:{register(route){assert.equal(route.path,'/api/dsh-medals');registered++;return()=>registered--;}},effect(fn){cleanup.push(fn());}};
  try {plugin.apply(ctx,{ledgerPath:join(dir,'ledger.json')});assert.equal(registered,1);}
  finally {for(const fn of cleanup.reverse())await fn?.();await rm(dir,{recursive:true,force:true});}
  assert.equal(registered,0);
});
