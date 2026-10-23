import {createElement as h,useEffect,useRef,useState} from 'react';

export const name='dsh-medals';
export const inject=['slots','locale','layout','sessions','uiWorkspace'];
const NS='dsh-medals',ID='dsh-medals';

// Shared new-medal count: the sidebar polls it, and the open gallery reports changes immediately.
const unseen={count:0,listeners:new Set(),set(value){if(value===this.count)return;this.count=value;this.listeners.forEach(listener=>listener());},subscribe(listener){this.listeners.add(listener);return()=>this.listeners.delete(listener);}};

function useUnseenCount(){
  const [count,setCount]=useState(unseen.count);
  useEffect(()=>{setCount(unseen.count);return unseen.subscribe(()=>setCount(unseen.count));},[]);
  useEffect(()=>{
    let stopped=false;const controller=new AbortController();
    const poll=async()=>{
      if(document.hidden)return;
      try{const response=await fetch('/api/dsh-medals/status',{signal:controller.signal});if(!response.ok)return;const data=await response.json();if(!stopped)unseen.set(data.challenges?.unseen?.length??0);}catch{}
    };
    void poll();const timer=setInterval(poll,30_000);
    return()=>{stopped=true;controller.abort();clearInterval(timer);};
  },[]);
  return count;
}

function MedalGlyph({size=18,dot=false}){
  return h('svg',{width:size,height:size,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.5,'aria-hidden':true},h('path',{d:'m8 9-3-6h5l2 4 2-4h5l-3 6'}),h('circle',{cx:12,cy:14,r:6}),h('path',{d:'m9 14 2 2 4-4'}),dot?h('circle',{cx:20,cy:4,r:3,fill:'#c99a45',stroke:'none'}):null);
}

function GalleryPanel({t,useMedalNavigation,useSessions,onReturn}){
  const frame=useRef(null),returnSessionId=useMedalNavigation(value=>value.returnSessionId),openCount=useMedalNavigation(value=>value.openCount);
  const language=t('meta.locale'),initialLanguage=useRef(language);
  const available=useSessions(value=>Boolean(returnSessionId&&value.byId[returnSessionId]));
  const sendContext=()=>{
    frame.current?.contentWindow?.postMessage({type:'dsh-medals:navigation',canReturn:available},location.origin);
    frame.current?.contentWindow?.postMessage({type:'dsh-medals:locale',locale:language},location.origin);
  };
  useEffect(()=>{
    const receive=event=>{
      if(event.origin!==location.origin||event.source!==frame.current?.contentWindow)return;
      if(event.data?.type==='dsh-medals:return'&&available)onReturn();
      if(event.data?.type==='dsh-medals:unseen'&&Number.isInteger(event.data.count))unseen.set(event.data.count);
    };
    window.addEventListener('message',receive);sendContext();
    return()=>window.removeEventListener('message',receive);
  },[available,onReturn,language]);
  // Each time the panel is opened, let the gallery play any new medals.
  useEffect(()=>{frame.current?.contentWindow?.postMessage({type:'dsh-medals:opened'},location.origin);},[openCount]);
  return h('section',{className:'dsh-medals-panel','aria-label':t('nav')},h('iframe',{ref:frame,title:t('nav'),src:'/api/dsh-medals/ui/?lang='+encodeURIComponent(initialLanguage.current),className:'dsh-medals-panel-frame',onLoad:sendContext}));
}

function SidebarEntry({wide=true,t,usePanelInfo,onOpen}){
  const active=usePanelInfo(info=>info.activePanelId===ID),label=t('nav'),count=useUnseenCount();
  const described=count?`${label} · ${count} ${t('newMedals')}`:label;
  return h('button',{type:'button',className:'dsh-medals-entry',title:described,'aria-label':described,'aria-current':active?'page':undefined,onClick:onOpen},h(MedalGlyph,{size:18,dot:count>0&&!wide}),wide?h('span',null,label):null,wide&&count>0?h('span',{className:'dsh-medals-count','aria-hidden':true},count>99?'99+':String(count)):null);
}

export function apply(ctx){
  let snapshot={returnSessionId:null,openCount:0},previousPanel=ctx.layout.panelInfo.getSnapshot().activePanelId;
  const listeners=new Set();
  const navigation={getSnapshot:()=>snapshot,subscribe:listener=>{listeners.add(listener);return()=>listeners.delete(listener);}};
  const publish=next=>{snapshot={...snapshot,...next};listeners.forEach(listener=>listener());};
  const setReturn=id=>{if(snapshot.returnSessionId!==id)publish({returnSessionId:id});};
  const onReturn=()=>{const id=snapshot.returnSessionId;if(id&&ctx.sessions.list.getSnapshot().byId[id])ctx.uiWorkspace.openSession(id);};
  ctx.effect(()=>ctx.locale.register(NS,{zh:{nav:'奖牌馆',newMedals:'枚新奖牌','meta.locale':'zh'},en:{nav:'Medals',newMedals:'new','meta.locale':'en'}}),'dsh-medals: dictionaries');
  ctx.effect(()=>ctx.layout.panelInfo.subscribe(()=>{
    const next=ctx.layout.panelInfo.getSnapshot().activePanelId;
    if(next===ID&&previousPanel!==ID)publish({openCount:snapshot.openCount+1});
    if(next===ID&&previousPanel===null){
      const id=Object.keys(ctx.sessions.list.getSnapshot().byId).find(id=>(ctx.sessions.retainInfo(id).getSnapshot().retainedBy.mainView??0)>0);
      setReturn(id??null);
    }else if(next!==ID)setReturn(null);
    previousPanel=next;
  }),'dsh-medals: originating conversation');
  ctx.effect(()=>{
    if(typeof document==='undefined')return;
    const style=document.createElement('style');style.dataset.plugin=ID;
    style.textContent='.dsh-medals-entry{display:flex;align-items:center;gap:8px;width:100%;min-height:36px;padding:8px 12px;border:0;border-radius:8px;background:transparent;color:inherit;font:inherit;font-size:13px;cursor:pointer}.dsh-medals-entry:hover,.dsh-medals-entry[aria-current=page]{background:color-mix(in srgb,currentColor 7%,transparent)}.dsh-medals-entry:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary,#1677ff));outline-offset:2px}.dsh-medals-count{margin-left:auto;min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:#e4c88d;color:#3d2e12;font-size:11px;font-weight:600;line-height:18px;text-align:center;font-variant-numeric:tabular-nums}.dsh-medals-panel{display:flex;flex:1;min-width:0;min-height:0;width:100%;height:100%;overflow:hidden}.dsh-medals-panel-frame{display:block;flex:1;min-width:0;min-height:0;width:100%;height:100%;border:0;background:transparent}';
    document.head.append(style);return()=>style.remove();
  },'dsh-medals: panel sizing');
  ctx.effect(()=>ctx.slots.inject('main',()=>ctx.slots.register({name:'main',key:ID,locale:NS,inject:()=>({hooks:{medalNavigation:navigation},onReturn})},GalleryPanel)),'dsh-medals: main panel');
  ctx.effect(()=>ctx.slots.inject('sidebar.footer.action',()=>ctx.slots.register({name:'sidebar.footer.action',id:ID,order:100,locale:NS,inject:()=>({onOpen:()=>ctx.layout.selectPanel(ID)})},SidebarEntry)),'dsh-medals: sidebar entry');
}
