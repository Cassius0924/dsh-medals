import {createServer} from 'node:http';
import {readFile,writeFile,rm} from 'node:fs/promises';
import {chromium} from '/opt/deepseek-harness/node_modules/.pnpm/playwright@1.61.1/node_modules/playwright/index.mjs';
import {CHALLENGES} from '../src/challenges.js';
import assert from 'node:assert/strict';
const server=createServer(async(req,res)=>{
 if(req.url==='/'){res.setHeader('content-type','text/html');return res.end('<!doctype html><meta charset="utf-8"><script src="/medal-renderer.js"></script><canvas style="width:768px;height:768px"></canvas>');}
 if(req.url==='/medal-renderer.js'){res.setHeader('content-type','text/javascript');return res.end(await readFile(new URL('../lib/ui/medal-renderer.js',import.meta.url)));}
 res.writeHead(404);res.end();
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
try {
 const page=await browser.newPage({viewport:{width:800,height:800},reducedMotion:'reduce'});
 await page.goto(`http://127.0.0.1:${server.address().port}/`,{timeout:90000});
 const filter=process.argv[2];
 const rules=CHALLENGES.filter(r=>!filter||(filter==='enamel'?(r.design==='numeric'||r.design==='rosette'):r.design===filter||r.id===filter));
 for(const rule of rules){
  const locked=false;
  const images=await page.evaluate(({rule,locked})=>{
   window.assetStage??=new MedalStage(document.querySelector('canvas'),{medal:{...rule,locked,period:'永久个人收藏',serial:'COLLECTION'}});
   const s=window.assetStage;s.setMedal({...rule,locked,period:'永久个人收藏',serial:'COLLECTION'});
   if(s.fallback||!MedalStage.diagnostics.webgl)throw new Error('Fallback assets require a working 3D renderer');
   return ['front','back'].map(side=>{s.orient(side);s.draw();return{side,url:s.canvas.toDataURL('image/png')};});
  },{rule,locked});
  for(const {side,url} of images)await writeFile(new URL(`../ui/assets/medals/${rule.design==='numeric'?rule.id:rule.design}-${side}.png`,import.meta.url),Buffer.from(url.split(',')[1],'base64'));
 }
 assert.equal(await page.evaluate(()=>MedalStage.diagnostics.webgl),true);
 for(const side of ['front','back'])await rm(new URL(`../ui/assets/medals/dawn-earned-${side}.png`,import.meta.url),{force:true});
 console.log(JSON.stringify({rendered:rules.length*2,webgl:await page.evaluate(()=>MedalStage.diagnostics.webgl)}));
} finally {await browser.close();await new Promise(r=>server.close(r));}
