import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {chromium} from '/opt/deepseek-harness/node_modules/.pnpm/playwright@1.61.1/node_modules/playwright/index.mjs';
import {createHandler} from '../src/http.js';
import {MedalsService} from '../src/service.js';
import {Ledger} from '../src/store.js';

const dir=await mkdtemp(join(process.env.TMPDIR,'medals-poll-'));
const service=new MedalsService({persistence:{list:async()=>[]},ledger:new Ledger(join(dir,'ledger.json'),'Asia/Shanghai')});
const server=createServer(createHandler({service,admit:()=>({peer:{}}),uiRoot:new URL('../lib/ui/',import.meta.url)}));
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
try{
  const page=await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/api/dsh-medals/ui/`);
  await page.locator('#collection-grid .medal-card').first().waitFor();
  await page.evaluate(()=>{window.retainedCard=document.querySelector('#collection-grid .medal-card');});
  const response=page.waitForResponse(r=>r.url().endsWith('/status'));
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await (await response).finished();
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  assert.equal(await page.evaluate(()=>window.retainedCard.isConnected),true,'unchanged usage polling must retain collection objects and focus targets');
  console.log(JSON.stringify({passed:true,unchangedPollRetainsCollection:true}));
}finally{await browser.close();await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true});}
