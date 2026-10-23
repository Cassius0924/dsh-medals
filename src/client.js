import {createElement as h,useEffect,useRef,useState} from 'react';

export const name='dsh-medals';
export const inject=['slots','locale','layout','sessions','uiWorkspace'];
const NS='dsh-medals',ID='dsh-medals';

function MedalGlyph({size=18}){
  const [unread,setUnread]=useState(false);
  useEffect(()=>{
    let stopped=false;const controller=new AbortController();
    const poll=async()=>{
      if(document.hidden)return;
      try{const response=await fetch('/api/dsh-medals/status',{signal:controller.signal});if(!response.ok)return;const data=await response.json();if(!stopped)setUnread((data.challenges?.unseen?.length??0)>0);}catch{}
    };
    void poll();const timer=setInterval(poll,30_000);
    return()=>{stopped=true;controller.abort();clearInterval(timer);};
  },[]);
  return h('svg',{width:size,height:size,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.5,'aria-hidden':true},h('path',{d:'m8 9-3-6h5l2 4 2-4h5l-3 6'}),h('circle',{cx:12,cy:14,r:6}),h('path',{d:'m9 14 2 2 4-4'}),unread?h('circle',{cx:20,cy:4,r:3,fill:'#3687e8',stroke:'none'}):null);
}

function GalleryPanel({t,useMedalNavigation,useSessions,onReturn}){
  const frame=useRef(null),returnSessionId=useMedalNavigation(value=>value.returnSessionId);
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
    };
    window.addEventListener('message',receive);sendContext();
    return()=>window.removeEventListener('message',receive);
  },[available,onReturn,language]);
  return h('section',{className:'dsh-medals-panel','aria-label':t('nav')},h('iframe',{ref:frame,title:t('nav'),src:'/api/dsh-medals/ui/?lang='+encodeURIComponent(initialLanguage.current),className:'dsh-medals-panel-frame',onLoad:sendContext}));
}

function SidebarEntry({wide=true,t,usePanelInfo,onOpen}){
  const active=usePanelInfo(info=>info.activePanelId===ID),label=t('nav');
  return h('button',{type:'button',className:'dsh-medals-entry',title:label,'aria-label':label,'aria-current':active?'page':undefined,onClick:onOpen},h(MedalGlyph,{size:18}),wide?h('span',null,label):null);
}

export function apply(ctx){
  let snapshot={returnSessionId:null},previousPanel=ctx.layout.panelInfo.getSnapshot().activePanelId;
  const listeners=new Set();
  const navigation={getSnapshot:()=>snapshot,subscribe:listener=>{listeners.add(listener);return()=>listeners.delete(listener);}};
  const setReturn=id=>{if(snapshot.returnSessionId===id)return;snapshot={returnSessionId:id};listeners.forEach(listener=>listener());};
  const onReturn=()=>{const id=snapshot.returnSessionId;if(id&&ctx.sessions.list.getSnapshot().byId[id])ctx.uiWorkspace.openSession(id);};
  ctx.effect(()=>ctx.locale.register(NS,{zh:{nav:'奖牌馆','meta.locale':'zh'},en:{nav:'Medals','meta.locale':'en'}}),'dsh-medals: dictionaries');
  ctx.effect(()=>ctx.layout.panelInfo.subscribe(()=>{
    const next=ctx.layout.panelInfo.getSnapshot().activePanelId;
    if(next===ID&&previousPanel===null){
      const id=Object.keys(ctx.sessions.list.getSnapshot().byId).find(id=>(ctx.sessions.retainInfo(id).getSnapshot().retainedBy.mainView??0)>0);
      setReturn(id??null);
    }else if(next!==ID)setReturn(null);
    previousPanel=next;
  }),'dsh-medals: originating conversation');
  ctx.effect(()=>{
    if(typeof document==='undefined')return;
    const style=document.createElement('style');style.dataset.plugin=ID;
    style.textContent='.dsh-medals-entry{display:flex;align-items:center;gap:8px;width:100%;min-height:36px;padding:8px 12px;border:0;border-radius:8px;background:transparent;color:inherit;font:inherit;font-size:13px;cursor:pointer}.dsh-medals-entry:hover,.dsh-medals-entry[aria-current=page]{background:color-mix(in srgb,currentColor 7%,transparent)}.dsh-medals-entry:focus-visible{outline:2px solid #1677ff;outline-offset:2px}.dsh-medals-panel{display:flex;flex:1;min-width:0;min-height:0;width:100%;height:100%;overflow:hidden}.dsh-medals-panel-frame{display:block;flex:1;min-width:0;min-height:0;width:100%;height:100%;border:0;background:#fff}';
    document.head.append(style);return()=>style.remove();
  },'dsh-medals: panel sizing');
  ctx.effect(()=>ctx.slots.inject('main',()=>ctx.slots.register({name:'main',key:ID,locale:NS,inject:()=>({hooks:{medalNavigation:navigation},onReturn})},GalleryPanel)),'dsh-medals: main panel');
  ctx.effect(()=>ctx.slots.inject('sidebar.footer.action',()=>ctx.slots.register({name:'sidebar.footer.action',id:ID,order:100,locale:NS,inject:()=>({onOpen:()=>ctx.layout.selectPanel(ID)})},SidebarEntry)),'dsh-medals: sidebar entry');
}
