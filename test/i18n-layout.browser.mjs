import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,rm,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {chromium} from 'playwright';
import {tmpdir} from 'node:os';
import {Ledger} from '../src/store.js';
import {MedalsService} from '../src/service.js';
import {createHandler} from '../src/http.js';

const dir=await mkdtemp(join(tmpdir(),'medals-localization-'));
const events=[['2026-09-01',250e6],['2026-10-19',30e6]].map(([date,n],turn)=>({type:'assistant/message',time:Date.parse(date+'T04:00:00Z'),data:{turn,step:0,usage:{inputTokens:n,outputTokens:0}}}));
let revision=1;
const persistence={list:async()=>[{header:{id:'localization-fixture'},revision}],open:async()=>({inheritedEventCount:0,read:async offset=>({events:events.slice(offset,offset+512)}),close:async()=>{}})};
const service=new MedalsService({persistence,ledger:new Ledger(join(dir,'ledger.json'),'Asia/Shanghai'),clock:()=>Date.parse('2026-10-23T04:00:00Z')});
const server=createServer(createHandler({service,admit:()=>({peer:{}}),uiRoot:new URL('../lib/ui/',import.meta.url)}));
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`,errors=[],measurements=[];
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-webgl']});
try{
  const page=await browser.newPage({locale:'zh-CN',viewport:{width:1280,height:900},reducedMotion:'reduce'});
  page.on('pageerror',e=>errors.push(e.message));
  const noChinese=async()=>assert.doesNotMatch(await page.locator('body').innerText(),/\p{Script=Han}/u);
  for(const language of ['zh','en']){
    await page.goto(`${origin}/api/dsh-medals/ui/?lang=${language}`);
    await page.locator('#collection-grid .medal-card').first().waitFor();
    assert.equal(await page.locator('#collection-grid .medal-card').count(),25);
    assert.equal(await page.locator('html').getAttribute('lang'),language==='zh'?'zh-CN':'en');
    if(language==='en')await noChinese();
    for(const width of [1280,768,390]){
      const viewportHeight=width===390?844:900;
      await page.setViewportSize({width,height:viewportHeight});
      await page.locator('[data-view="progress"]').click();
      for(const period of ['day','week','month','lifetime']){
        await page.locator(`[data-period="${period}"]`).click();
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${language}/${width}/${period} overflow`);
        if(language==='en')await noChinese();
        if(period==='day'){
          const rows=await page.locator('.task').evaluateAll(es=>es.map(e=>({height:e.getBoundingClientRect().height,bottom:e.getBoundingClientRect().bottom})));
          assert.equal(rows.length,3);
          assert(rows[2].bottom<=viewportHeight,`${language}/${width}: three daily challenges must fit in one viewport`);
          assert(rows.every(r=>r.height<=160),`${language}/${width}: daily rows must remain compact`);
          measurements.push({language,width,rowHeights:rows.map(r=>r.height),thirdBottom:rows[2].bottom});
          await mkdir(new URL('../evidence/',import.meta.url),{recursive:true});
          if(width!==768)await page.screenshot({path:new URL(`../evidence/compact-${language}-${width}.png`,import.meta.url).pathname,fullPage:true});
        }
      }
    }
    await page.locator('[data-view="collection"]').click();
    await page.locator('#collection-grid [data-medal="tokens-100M"]').click();
    assert.equal(await page.locator('.rotate-controls').isVisible(),true);
    await page.locator('[data-orient="back"]').click();
    if(language==='en')await noChinese();
    await page.locator('#detail-close').click();
    await page.locator('#collection-grid [data-medal="daily-1"]').click();
    assert.equal(await page.locator('.rotate-controls').isVisible(),false);
    if(language==='en')await noChinese();
    await page.locator('#detail-close').click();
    for(let i=0;i<5;i++)await page.locator('#gallery-title').click({force:true});
    if(language==='en')await noChinese();
    await page.locator('[data-debug-state="locked"]').click();
    if(language==='en')await noChinese();
    for(let i=0;i<5;i++)await page.locator('#gallery-title').click({force:true});
  }
  await page.locator('#collection-grid .medal-card').first().evaluate(el=>{window.retainedCard=el;});
  const polled=page.waitForResponse(r=>r.url().endsWith('/status'));
  await page.evaluate(()=>dispatchEvent(new Event('focus')));await (await polled).finished();
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  assert.equal(await page.evaluate(()=>retainedCard.isConnected),true);
  events.push({type:'assistant/message',time:Date.parse('2026-10-23T04:00:00Z'),data:{turn:2,step:0,usage:{inputTokens:550e6,outputTokens:0}}});revision++;
  await page.evaluate(()=>dispatchEvent(new Event('focus')));
  await page.locator('#reveal-trigger').waitFor();await page.locator('#reveal-trigger').click();
  await noChinese();
  const unseen=(await service.refresh()).challenges.unseen.length;
  const acknowledged=page.waitForResponse(r=>r.url().endsWith('/challenges/ack'));
  const resynced=page.waitForResponse(r=>r.url().endsWith('/status'));
  await page.locator('#reveal-close').click();
  await page.waitForFunction(()=>!document.querySelector('#reveal-dialog').open);
  await acknowledged;await resynced;
  assert.equal((await service.refresh()).challenges.unseen.length,unseen-1);
  await page.route('**/api/dsh-medals/status',route=>route.fulfill({status:503,json:{errorCode:'UNAVAILABLE'}}),{times:1});
  await page.evaluate(()=>dispatchEvent(new Event('focus')));
  await page.locator('#sync-status').filter({hasText:'Medals cannot read sessions'}).waitFor();
  await noChinese();assert.equal(await page.locator('#sync-retry').isVisible(),true);
  // An actual iframe exercises the same-origin and frame-identity locale bridge.
  await page.route('**/host-test',route=>route.fulfill({contentType:'text/html',body:'<iframe src="/api/dsh-medals/ui/?lang=zh" style="width:100%;height:900px"></iframe>'}));
  await page.goto(origin+'/host-test');const frame=page.frameLocator('iframe');
  await frame.locator('#collection-grid .medal-card').first().waitFor();
  // Remaining new medals play automatically when the panel opens.
  await frame.locator('#reveal-dialog[open]').waitFor();await frame.locator('#reveal-close').click();
  await frame.locator('#reveal-dialog:not([open])').waitFor({state:'attached'});
  await frame.locator('[data-view="progress"]').click();await frame.locator('[data-period="week"]').click();
  await page.evaluate(()=>document.querySelector('iframe').contentWindow.postMessage({type:'dsh-medals:locale',locale:'en'},location.origin));
  await frame.locator('#progress-title').filter({hasText:'This week'}).waitFor();
  assert.doesNotMatch(await frame.locator('body').innerText(),/\p{Script=Han}/u);
  assert.equal(await frame.locator('[data-period="week"]').getAttribute('aria-pressed'),'true');
  await page.evaluate(()=>document.querySelector('iframe').contentWindow.postMessage({type:'dsh-medals:locale',locale:'zh'},location.origin));
  await frame.locator('#progress-title').filter({hasText:'本周挑战'}).waitFor();
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({passed:true,languages:['zh','en'],liveLocaleSwitch:true,pollRetainsCollection:true,measurements,errors}));
}finally{await browser.close();await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true});}
