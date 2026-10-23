import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
import {chromium} from '/opt/deepseek-harness/node_modules/.pnpm/playwright@1.61.1/node_modules/playwright/index.mjs';
const origin='http://127.0.0.1:3080';
const log=execFileSync('journalctl',['-u','dsh.service','-b','--no-pager','-n','7000'],{maxBuffer:8*1024*1024,encoding:'utf8'});
const launch=[...log.matchAll(/https?:\/\/[^\s]+\?token=[A-Za-z0-9_-]+/g)].map(m=>m[0]).filter(s=>new URL(s).origin===origin).at(-1);
if(!launch)throw new Error('No live DSH authentication launch URL available');
const exchange=await fetch(launch,{redirect:'manual',signal:AbortSignal.timeout(10000)}).catch(()=>{throw new Error('DSH login exchange failed');});
assert.equal(exchange.status,303,'Live launch-token exchange should issue a cookie');
const cookies=exchange.headers.getSetCookie().map(line=>{const [pair]=line.split(';');const i=pair.indexOf('=');return{name:pair.slice(0,i),value:pair.slice(i+1),domain:'127.0.0.1',path:'/',httpOnly:true,sameSite:'Strict',secure:false};});
assert(cookies.length>0);
const cookieHeader=cookies.map(c=>`${c.name}=${c.value}`).join('; ');

async function rpc(method,args){
 const r=await fetch(origin+'/api/'+method,{method:'POST',headers:{'content-type':'application/json',cookie:cookieHeader},body:JSON.stringify({type:'client-request',rpcId:'medals-deploy-inspect',method,payload:{args}}),signal:AbortSignal.timeout(60000)});
 if(r.status!==200)throw new Error(`RPC ${method} HTTP ${r.status}`);return r.json();
}
const plugins=await rpc('pluginManager/listPlugins',{});
console.log(JSON.stringify({pluginsResult:plugins.result?.ok,plugins:(plugins.result?.value??[]).filter(x=>/hmr|medals/.test(x.id??'')).map(x=>({id:x.id,name:x.name,status:x.status,enabled:x.enabled,disabled:x.disabled}))}));
const sessions=await rpc('session/list',{_request:{}});
const val=sessions.result?.value;
console.log(JSON.stringify({sessionResult:sessions.result?.ok,keys:val?Object.keys(val):[],error:sessions.result?.error}));
if(val){const list=Array.isArray(val)?val:val.items??[];console.log(JSON.stringify({sessionCount:list.length,running:list.filter(x=>x.running).map(x=>({id:x.id,running:x.running}))}));}
