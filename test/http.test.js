import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import * as http from '../src/http.js';
import {CHALLENGES} from '../src/challenges.js';

test('plugin API rejects cross-site access and serves only explicit UI assets', async () => {
  assert.equal(typeof http.createHandler,'function');
  const handler=http.createHandler({service:{refresh:async()=>({total:123,complete:true}),acknowledge:async()=>({ok:true})},uiRoot:new URL('../ui/',import.meta.url),admit:()=>({peer:{}})});
  const server=createServer(handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base=`http://127.0.0.1:${server.address().port}/api/dsh-medals`;
  try {
    assert.equal((await fetch(`${base}/status`)).status,200);
    assert.equal((await fetch(`${base}/status`,{headers:{origin:'https://evil.test'}})).status,403);
    assert.equal((await fetch(`${base}/status`,{headers:{'sec-fetch-site':'cross-site'}})).status,403);
    assert.equal((await fetch(`${base}/ui/package.json`)).status,404);
    for(const rule of CHALLENGES)for(const side of ['front','back']){
      const artwork=rule.design==='numeric'?rule.id:rule.design;
      const asset=await fetch(`${base}/ui/assets/medals/${artwork}-${side}.png`);
      assert.equal(asset.status,200,`${rule.name} ${side} must be available to fallback clients`);
      assert.equal(asset.headers.get('content-type'),'image/png');
      await asset.arrayBuffer();
    }
    assert.equal((await fetch(`${base}/ui/assets/medals/arbitrary-front.png`)).status,404);
    assert.equal((await fetch(`${base}/status`,{method:'POST'})).status,405);
    assert.equal((await fetch(`${base}/ack`,{method:'POST',headers:{'content-type':'application/json'},body:'not json'})).status,400);
  } finally {await new Promise(r=>server.close(r));}
});


test('an unconfigured or unauthenticated carrier cannot read private medals', async () => {
  const handler=http.createHandler({service:{refresh:async()=>({total:123})},uiRoot:new URL('../ui/',import.meta.url)});
  const server=createServer(handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));
  try {assert.equal((await fetch(`http://127.0.0.1:${server.address().port}/api/dsh-medals/status`)).status,401);}
  finally {await new Promise(r=>server.close(r));}
});

test('authenticated challenge acknowledgements validate bounded JSON',async()=>{
 const handler=http.createHandler({service:{acknowledgeChallenges:async ids=>({ids})},uiRoot:new URL('../ui/',import.meta.url),admit:()=>({peer:{}})});
 const server=createServer(handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}/api/dsh-medals`;
 try{
  const ack=await fetch(base+'/challenges/ack',{method:'POST',headers:{'content-type':'application/json'},body:'{"ids":["daily-1:2026-10-23"]}'});assert.equal(ack.status,200);
  assert.equal((await fetch(base+'/challenges/ack',{method:'POST',headers:{'content-type':'application/json'},body:'{"ids":[12]}'})).status,400);
 }finally{await new Promise(r=>server.close(r));}
});
