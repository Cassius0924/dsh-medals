import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {Context} from '../node_modules/@deepseek-ai/cordis/lib/index.js';
import WebServer from '/opt/deepseek-harness/packages/host/webserver/lib/index.js';
import * as plugin from '../lib/index.js';
const dir=await mkdtemp(join(tmpdir(),'medals-native-routing-'));
const host=new Context(),cleanups=[];
try {
 await host.plugin(WebServer,{host:'127.0.0.1',port:0});
 plugin.apply({webServer:host.webServer,sessionPersistence:{list:async()=>[]},connection:{admit:()=>({peer:{}})},effect(fn){cleanups.push(fn());}},{ledgerPath:join(dir,'ledger.json')});
 const base=`http://127.0.0.1:${host.webServer.port}`;
 const status=await fetch(base+'/api/dsh-medals/status');assert.equal(status.status,200);assert.equal((await status.json()).complete,true);
 const gallery=await fetch(base+'/api/dsh-medals/ui/');assert.equal(gallery.status,200);assert.match(await gallery.text(),/奖牌馆/);
 console.log(JSON.stringify({passed:true,nativeWebServer:true,statusEndpoint:200,galleryEndpoint:200}));
} finally {for(const cleanup of cleanups.reverse())await cleanup?.();await host.fiber.dispose();await rm(dir,{recursive:true,force:true});}
