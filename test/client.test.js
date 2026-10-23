import test from 'node:test';
import assert from 'node:assert/strict';
import * as client from '../src/client.js';

test('native panel navigation captures and reopens the exact originating conversation',()=>{
 const entries=[],cleanups=[],listeners=new Set(),opened=[];let activePanelId=null,current='a';
 const layout={panelInfo:{getSnapshot:()=>({activePanelId}),subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);}},selectPanel:id=>{activePanelId=id;listeners.forEach(fn=>fn());}};
 const ctx={layout,sessions:{list:{getSnapshot:()=>({ids:['a','b'],byId:{a:{},b:{}}})},retainInfo:id=>({getSnapshot:()=>({retainedBy:{mainView:id===current?1:0}})})},uiWorkspace:{openSession:id=>{opened.push(id);layout.selectPanel(null);}},effect:fn=>{cleanups.push(fn());},locale:{register:()=>()=>{},bind:()=>()=> '奖牌馆'},slots:{inject:(_,fn)=>fn(),register:(options,component)=>{entries.push([options,component]);return()=>entries.splice(entries.findIndex(([o])=>o===options),1);}}};
 client.apply(ctx);
 assert.deepEqual(entries.map(([o])=>o.name),['main','sidebar.footer.action']);
 const main=entries.find(([o])=>o.name==='main')[0],face=main.inject();
 layout.selectPanel('dsh-medals');
 assert.equal(face.hooks.medalNavigation.getSnapshot().returnSessionId,'a');
 current='b';face.onReturn();assert.deepEqual(opened,['a']);
 layout.selectPanel('plugins');layout.selectPanel('dsh-medals');
 assert.equal(face.hooks.medalNavigation.getSnapshot().returnSessionId,null);
 for(const cleanup of cleanups.reverse())cleanup?.();
 assert.equal(entries.length,0);assert.equal(listeners.size,0);
});
