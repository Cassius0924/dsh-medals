import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {Context} from '../node_modules/@deepseek-ai/cordis/lib/index.js';
import * as jsonl from '/opt/deepseek-harness/packages/session/session-persistence-jsonl/lib/index.js';
import {tokenUsageProjectionDefinition as official} from '/opt/deepseek-harness/packages/llm/token-meter/lib/types/usage-projection.js';
import {MedalsService} from '../src/service.js';
import {foldUsage} from '../src/usage.js';
import {Ledger} from '../src/store.js';
const dir=await mkdtemp(join(tmpdir(),'medals-real-'));
const ctx=new Context();
try {
 await ctx.plugin(jsonl,{root:'/root/.dsh/sessions',compression:'zstd'});
 const persistence=ctx.sessionPersistence;
 const service=new MedalsService({persistence,ledger:new Ledger(join(dir,'ledger.json'),'Asia/Shanghai')});
 const status=await service.refresh();
 if(!status.complete){
  for(const snapshot of await persistence.list()){
   let handle;try{handle=await persistence.open(snapshot.header.id,'read');const {events}=await handle.read();foldUsage(events,{timeZone:'Asia/Shanghai',inheritedEventCount:handle.inheritedEventCount});}
   catch(e){console.error(JSON.stringify({session:snapshot.header.id,error:e.message}));}finally{await handle?.close();}
  }
 }
 assert.equal(status.complete,true);
 let officialTotal=0,checked=0,seeded=0;
 for(const session of await persistence.list()) {
  let handle;
  try {handle=await persistence.open(session.header.id,'read');
   if(handle.inheritedEventCount){seeded++;continue;}
   let state=official.init();
   for(let offset=0;;){const {events}=await handle.read(offset,512);if(!events.length)break;for(const event of events)state=official.apply(state,event);offset+=events.length;}
   officialTotal+=Object.values(state.totals).reduce((a,b)=>a+b,0);checked++;
  } catch(e){if(e.name!=='SessionFormatUnsupportedError')throw e;} finally {await handle?.close();}
 }
 if(!seeded)assert.equal(status.total,officialTotal);
 const result={passed:true,sessionCount:status.sessionCount,total:status.total,officialProjectionTotal:officialTotal,projectionChecked:checked,seededSessions:seeded,challengeAwards:status.challenges.awards.map(({ruleId,period,earnedOn})=>({ruleId,period,earnedOn})),awards:status.awards.map(({ruleId,period,earnedOn})=>({ruleId,period,earnedOn})),timeZone:status.timeZone};
 await mkdir(new URL('../evidence/',import.meta.url),{recursive:true});await writeFile(new URL('../evidence/real-history.json',import.meta.url),JSON.stringify(result,null,2));
 console.log(JSON.stringify(result));
} finally {await ctx.fiber.dispose();await rm(dir,{recursive:true,force:true});}
