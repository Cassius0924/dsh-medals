import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from '/opt/deepseek-harness/node_modules/.pnpm/playwright@1.61.1/node_modules/playwright/index.mjs';
const server=createServer(async(req,res)=>{if(req.url==='/'){res.setHeader('content-type','text/html');res.end('<!doctype html><script src="/medal-renderer.js"></script><canvas style="width:400px;height:400px"></canvas>');}else{res.setHeader('content-type','text/javascript');res.end(await readFile(new URL('../lib/ui/medal-renderer.js',import.meta.url)));}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
try{
 const page=await browser.newPage({viewport:{width:600,height:600},reducedMotion:'reduce'});
 await page.addInitScript(()=>{window.webglRequested=0;window.allowWebGL=false;const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){if(/webgl/i.test(type)){window.webglRequested++;if(!window.allowWebGL)return null;}return get.call(this,type,...args);};});
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 const result=await page.evaluate(()=>{window.medal={id:'daily-1',design:'numeric',number:'1',series:'daily',grade:0,name:'每日达标',metal:'silver',locked:true,serial:'—',period:'尚未解锁',inscription:'每一天，留下一点光'};window.s=new MedalStage(document.querySelector('canvas'),{medal:window.medal,interactive:true});return{requested:window.webglRequested,pixels:s.canvas.getContext('2d').getImageData(0,0,s.canvas.width,s.canvas.height).data.some((v,i)=>i%4===3&&v>0)};});
 assert.equal(result.requested,0,'locked medals must never construct a 3D context');assert.equal(result.pixels,true);
 const hash=b=>createHash('sha256').update(b).digest('hex');const locked=hash(await page.locator('canvas').screenshot());await page.evaluate(()=>s.orient('back'));assert.equal(hash(await page.locator('canvas').screenshot()),locked);
 await page.evaluate(()=>{window.allowWebGL=true;s.setMedal({...medal,locked:false,serial:'000001'});});
 assert.equal(await page.evaluate(()=>MedalStage.diagnostics.webgl),true);
 const colorPixels=await page.evaluate(()=>{s.orient('front');const data=s.ctx.getImageData(0,0,s.canvas.width,s.canvas.height).data;let count=0;for(let i=0;i<data.length;i+=4)if(data[i]>data[i+1]*1.4&&data[i]>data[i+2]*1.15&&data[i+3]>220)count++;return count;});assert(colorPixels>2000,`earned daily enamel must be visible, got ${colorPixels} colored pixels`);
 const front=hash(await page.locator('canvas').screenshot());await page.evaluate(()=>s.orient('back'));assert.notEqual(hash(await page.locator('canvas').screenshot()),front);
 await page.evaluate(()=>{s.visible=false;for(let i=2;i<=13;i++)s.setMedal({...medal,locked:false,serial:String(i).padStart(6,'0')});});assert((await page.evaluate(()=>MedalStage.diagnostics.cachedModels))<=10,'visited award geometry cache must be bounded');
 await page.evaluate(()=>{s.visible=true;window.classic={...medal,id:'beyond',design:'beyond',name:'无尽远行',metal:'silver',locked:false,serial:'000001'};s.setMedal(classic);s.orient('front');});
 const classic=hash(await page.locator('canvas').screenshot());
 await page.evaluate(()=>{s.setMedal({...classic,id:'tokens-500M'});s.orient('front');});
 assert.equal(hash(await page.locator('canvas').screenshot()),classic,'challenge artwork retains the original sculpted geometry and material palette');
 console.log(JSON.stringify({passed:true,lockedOutlineOnly:true,lockedRotationDisabled:true,unlockCreatesReal3D:true,frontBackDifferent:true}));
}finally{await browser.close();await new Promise(r=>server.close(r));}
