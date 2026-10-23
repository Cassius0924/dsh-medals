import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import {chromium} from '/opt/deepseek-harness/node_modules/.pnpm/playwright@1.61.1/node_modules/playwright/index.mjs';
import {CHALLENGES} from '../src/challenges.js';
const baseline=process.argv.includes('--baseline');
const rules=['days-365','tokens-1B','growth-month','days-100','growth-week','volume-week'].map(id=>CHALLENGES.find(r=>r.id===id));
const server=createServer(async(req,res)=>{
 if(req.url==='/medal-renderer.js'){res.setHeader('content-type','text/javascript');return res.end(await readFile(new URL('../lib/ui/medal-renderer.js',import.meta.url)));}
 res.setHeader('content-type','text/html; charset=utf-8');
 res.end('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><style>body{margin:0;background:#f7f8fa;color:#333;font:16px system-ui}main{display:grid;grid-template-columns:repeat(3,1fr)}figure{margin:0;text-align:center}canvas{display:block;width:100%;height:300px}figcaption{height:36px}#detail{width:500px;height:500px;background:#14191e;margin:auto}</style><script src="/medal-renderer.js"></script><main></main></html>');
});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
try{
 const page=await browser.newPage({viewport:{width:1080,height:720},reducedMotion:'reduce'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${server.address().port}/`);
 await page.evaluate(rules=>{window.samples=[];for(const rule of rules){const figure=document.createElement('figure'),canvas=document.createElement('canvas'),caption=document.createElement('figcaption');caption.textContent=rule.name;figure.append(canvas,caption);document.querySelector('main').append(figure);samples.push(new MedalStage(canvas,{medal:{...rule,locked:false,period:'样式预览',serial:'PREVIEW',inscription:'每一天，留下一点光'}}));}},rules);
 await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 assert.equal(await page.evaluate(()=>MedalStage.diagnostics.webgl),true);
 const measurements=await page.evaluate(()=>samples.map(s=>{const c=s.canvas,ctx=c.getContext('2d'),r=Math.min(c.width,c.height)*.12,x=Math.floor(c.width/2-r),y=Math.floor(c.height/2-r),size=Math.floor(r*2),pixels=ctx.getImageData(x,y,size,size).data;let sum=0,bright=0,n=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i+3]>220){const l=.2126*pixels[i]+.7152*pixels[i+1]+.0722*pixels[i+2];sum+=l;n++;if(l>80)bright++;}return{id:s.medal.id,centerLuminance:Math.round(sum/n),visibleReliefPixels:bright,opaquePixels:n};}));
 const path=new URL(`../evidence/lighting-${baseline?'before':'after'}.png`,import.meta.url).pathname;await page.screenshot({path,timeout:120000});
 if(!baseline){
  const before=JSON.parse(await readFile(new URL('../evidence/lighting-before.json',import.meta.url),'utf8'));
  for(const id of ['days-365','tokens-1B','growth-month']){const old=before.measurements.find(m=>m.id===id),current=measurements.find(m=>m.id===id);assert(current.centerLuminance>old.centerLuminance+15,`${id} central relief must be readable: ${old.centerLuminance} -> ${current.centerLuminance}`);}
  await page.evaluate(()=>{const tree=samples[3];samples.forEach(s=>s.dispose());document.querySelector('main').replaceChildren();const c=document.createElement('canvas');c.id='detail';c.tabIndex=0;document.querySelector('main').style.display='block';document.querySelector('main').append(c);window.detail=new MedalStage(c,{medal:{...tree.medal,locked:false},interactive:true});});
  await page.screenshot({path:new URL('../evidence/evergreen-earned-desktop.png',import.meta.url).pathname,timeout:120000});
  await page.evaluate(()=>{detail.orient('back');});await page.screenshot({path:new URL('../evidence/evergreen-back.png',import.meta.url).pathname,timeout:120000});
  await page.setViewportSize({width:390,height:650});await page.evaluate(()=>{const c=document.querySelector('canvas');c.style.width='360px';c.style.height='440px';detail.setMedal({...detail.medal,locked:true});detail.draw();});
  await page.screenshot({path:new URL('../evidence/evergreen-locked-mobile.png',import.meta.url).pathname,timeout:120000});
  assert.equal(await page.evaluate(()=>detail.model===null),true);
 }
 assert.deepEqual(errors,[]);await writeFile(new URL(`../evidence/lighting-${baseline?'before':'after'}.json`,import.meta.url),JSON.stringify({passed:true,measurements,errors},null,2));
 console.log(JSON.stringify({passed:true,baseline,measurements}));
}finally{await browser.close();await new Promise(r=>server.close(r));}
