import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from '/opt/deepseek-harness/node_modules/.pnpm/playwright@1.61.1/node_modules/playwright/index.mjs';
import {CHALLENGES} from '../src/challenges.js';
import {Ledger} from '../src/store.js';
import {MedalsService} from '../src/service.js';
import {createHandler} from '../src/http.js';
const dir=await mkdtemp(join(tmpdir(),'medals-enamel-'));
const events=[{type:'assistant/message',time:Date.parse('2026-10-22T04:00:00Z'),data:{turn:0,step:0,usage:{inputTokens:600e6,outputTokens:0}}}];
const persistence={list:async()=>[{header:{id:'enamel-fixture'},revision:1}],open:async()=>({inheritedEventCount:0,read:async offset=>({events:events.slice(offset,offset+512)}),close:async()=>{}})};
const service=new MedalsService({persistence,ledger:new Ledger(join(dir,'ledger.json'),'Asia/Shanghai'),clock:()=>Date.parse('2026-10-23T04:00:00Z')});
const initial=await service.refresh();
const handler=createHandler({service,admit:()=>({peer:{}}),uiRoot:new URL('../lib/ui/',import.meta.url)});
const server=createServer(async(req,res)=>{
 if(req.url==='/studio'){
  res.setHeader('content-type','text/html; charset=utf-8');
  return res.end('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>珐琅圆章渲染对照</title><style>body{margin:0;background:#f7f8fa;font:18px system-ui;color:#222}main{display:grid;grid-template-columns:repeat(4,1fr);gap:0}figure{margin:0;text-align:center}canvas{display:block;width:384px;height:384px}figcaption{height:44px}</style><script src="/api/dsh-medals/ui/medal-renderer.js"></script><main></main></html>');
 }
 return handler(req,res);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
const review=process.argv.includes('--review');
const errors=[],failures=[];const base=`http://127.0.0.1:${server.address().port}`;
const capture=async(page,name)=>page.screenshot({path:new URL(`../evidence/${name}.png`,import.meta.url).pathname,fullPage:name.includes('gallery'),timeout:120000});
try{
 const page=await browser.newPage({viewport:{width:1536,height:880},reducedMotion:'reduce',deviceScaleFactor:1});
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failures.push({path:new URL(r.url()).pathname,status:r.status()});});
 await page.goto(base+'/studio');
 const rules=['daily-1','week-days-7','month-days-20','month-days-all'].map(id=>CHALLENGES.find(r=>r.id===id));
 await page.evaluate(rules=>{
  window.studioStages=[];
  for(const locked of [false,true])for(const rule of rules){
   const figure=document.createElement('figure'),canvas=document.createElement('canvas'),caption=document.createElement('figcaption');
   caption.textContent=rule.name+' · '+(locked?'未获得':'已获得');canvas.tabIndex=0;figure.append(canvas,caption);document.querySelector('main').append(figure);
   const s=new MedalStage(canvas,{medal:{...rule,locked,period:'样式预览',serial:'PREVIEW',inscription:'每一天，留下一点光'},interactive:true});window.studioStages.push(s);
  }
 },rules);
 await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 assert.equal(await page.evaluate(()=>MedalStage.diagnostics.webgl),true);
 for(const result of await page.evaluate(()=>studioStages.map(s=>({name:s.medal.name,locked:s.medal.locked,fallback:s.fallback}))))assert.equal(result.fallback,false,`${result.name} must render real 3D`);
 await capture(page,'enamel-studio');
 const hash=data=>createHash('sha256').update(data).digest('hex');
 const front=hash(await page.locator('canvas').first().screenshot());
 await page.evaluate(()=>studioStages[0].orient('back'));
 assert.notEqual(hash(await page.locator('canvas').first().screenshot()),front);
 await page.locator('canvas').first().focus();await page.keyboard.press('ArrowRight');
 assert.notEqual(await page.evaluate(()=>studioStages[0].y),Math.PI);
 const details=await page.evaluate(()=>studioStages.filter(s=>!s.medal.locked).map(s=>{let meshes=0,vertices=0;s.model.traverse(o=>{if(o.isMesh){meshes++;vertices+=o.geometry.attributes.position.count;}});return{id:s.medal.id,meshes,vertices};}));
 assert(details.every(d=>d.meshes>10&&d.vertices>1000));
 await page.goto(base+'/api/dsh-medals/ui/?lang=zh');await page.locator('#collection-grid .medal-card').first().waitFor();
 await page.locator('#debug-toggle').click();
 if(review)await page.locator('[data-filter="monthly"]').click();
 await page.locator('#collection-grid').scrollIntoViewIfNeeded();
 if(!review)await page.evaluate(async()=>{for(let y=0;y<document.documentElement.scrollHeight;y+=innerHeight*.7){scrollTo(0,y);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));}scrollTo(0,0);});
 await capture(page,'enamel-gallery-desktop');
 await page.locator('[data-medal="month-days-all"]').click();assert.equal(await page.locator('.rotate-controls').isVisible(),true);await capture(page,'enamel-rosette-detail');await page.locator('#detail-close').click();
 await page.setViewportSize({width:390,height:844});await capture(page,'enamel-gallery-mobile');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 if(review)await page.locator('[data-filter="daily"]').click();
 await page.locator('[data-medal="daily-4"]').click();await capture(page,'enamel-daily-mobile');await page.locator('#detail-close').click();
 await page.locator('[data-debug-state="locked"]').click();
 if(review)await page.locator('[data-filter="monthly"]').click();
 await page.locator('[data-medal="month-days-all"]').click();assert.equal(await page.locator('.rotate-controls').isVisible(),false);await capture(page,'enamel-locked-mobile');
 assert.deepEqual((await service.refresh()).challenges.awards,initial.challenges.awards);
 assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);
 await writeFile(new URL('../evidence/enamel-verification.json',import.meta.url),JSON.stringify({passed:true,real3D:details,frontBack:true,keyboardRotation:true,readOnlyPreview:true,mobileOverflow:false,errors,failures},null,2));
 console.log(JSON.stringify({passed:true,details,errors,failures}));
}finally{await browser.close();await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true});}
