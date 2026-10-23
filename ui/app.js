(() => {
  'use strict';
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const paths={medal:'<circle cx="12" cy="14" r="6"/><path d="m8 9-3-6h5l2 4 2-4h5l-3 6M10 14l1.5 1.5 3-3"/>',arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>',check:'<path d="m5 12 4 4L19 6"/>',lock:'<rect x="6" y="10" width="12" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v2"/>',clock:'<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>',reset:'<path d="M4 10a8 8 0 1 1 1 7M4 4v6h6"/>',info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-9v.1"/>',spin:'<path d="M5 8C1 11 3 17 12 17s11-6 7-9M9 3l3 3-3 3m3-3H5m4 11 3 3 3-3"/>',close:'<path d="m6 6 12 12M18 6 6 18"/>'};
  const icon=n=>`<svg viewBox="0 0 24 24" aria-hidden="true">${paths[n]||paths.medal}</svg>`;
  $$('[data-icon]').forEach(el=>{el.innerHTML=icon(el.dataset.icon);});
  const i18n=MedalsI18n.createI18n(new URL(location.href).searchParams.get('lang')||navigator.language);
  const t=i18n.t,date=value=>i18n.date(value),series=key=>t('series.'+key),grade=key=>t('grade.'+key);
  const fmt=n=>n>=1e9?`${i18n.number(n/1e9,{maximumFractionDigits:2})}B`:n>=1e6?`${i18n.number(n/1e6,{maximumFractionDigits:2})}M`:n>=1e3?`${i18n.number(n/1e3,{maximumFractionDigits:1})}K`:i18n.number(n??0);
  const state={view:'collection',filter:'all',period:'day',hero:null,selected:null,snapshot:null,medals:[],revealing:null,debug:null};
  const stages=new Map();let heroStage,detailStage,revealStage,progressStages=[],lastFocus,loading=false,toastTimer;
  const awards=()=>state.snapshot.challenges.awards;
  const recordsLabel=a=>a.period==='lifetime'?t('lifetimeTotal'):a.end?t('periodRange',{start:date(a.period),end:date(a.end)}):date(a.period);
  function requirement(m){
    if(m.metric==='growth')return t('growthRequirement',{period:t(m.unit==='week'?'weekUnit':'monthUnit'),growth:i18n.number(m.growth*100),minimum:fmt(m.minimum)});
    if(m.metric==='days')return m.perfect?t(m.unit==='week'?'perfectWeekRequirement':'perfectMonthRequirement'):t('daysRequirement',{period:t(m.unit==='lifetime'?'lifetimeScope':m.unit==='week'?'weekScope':'monthScope'),target:i18n.number(m.target)});
    return t('tokensRequirement',{period:t(m.unit==='day'?'dayTokensScope':m.unit==='lifetime'?'lifetimeScope':m.unit==='week'?'weekTokensScope':'monthTokensScope'),target:fmt(m.target)});
  }
  function progressText(m){
    const c=state.snapshot.challenges.progress[m.id];if(!c)return '';
    if(!c.eligible)return t('lowBaseline',{previous:fmt(c.previous),minimum:fmt(m.minimum)});
    if(c.earned)return t(m.unit==='lifetime'?'lifetimeEarned':'periodEarned');
    if(m.perfect&&c.period<state.snapshot.challenges.enabledOn)return t('partialPeriod');
    const remaining=Math.max(0,c.target-c.current),unit=m.metric==='days'?t('daysUnit'):(i18n.locale==='zh'?' tokens':'tokens');
    return (remaining?t('remaining',{amount:m.metric==='days'?i18n.number(remaining):fmt(remaining),unit}):t('thresholdMet'))+(c.settlesOn?t('settles',{date:date(c.settlesOn)}):'');
  }
  function model(rule){
    const actual=awards().filter(a=>a.ruleId===rule.id).sort((a,b)=>b.earnedOn.localeCompare(a.earnedOn)||b.serial.localeCompare(a.serial));
    const preview=state.debug!==null,records=preview?(state.debug==='earned'?[{period:t('debugPeriod'),serial:'PREVIEW',earnedOn:''}]:[]):actual;
    const latest=records[0];
    return {...rule,name:i18n.medalName(rule),preview,records,locked:!latest,period:latest?recordsLabel(latest):t('notUnlocked'),serial:latest?.serial??'—',inscription:i18n.locale==='en'?(t('inscription.'+rule.design)!=='inscription.'+rule.design?t('inscription.'+rule.design):t('defaultInscription')):rule.inscription||t('defaultInscription')};
  }
  function rebuild(){state.medals=state.snapshot.challenges.rules.map(model);renderCards();setView(state.view);}
  function setDebug(mode){
    state.debug=mode;$('#debug-toolbar').hidden=mode===null;
    $('#debug-toggle').setAttribute('aria-pressed',String(mode!==null));$('#debug-toggle').textContent=t(mode===null?'debugOpen':'debugExit');
    $$('[data-debug-state]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.debugState===mode)));
    rebuild();
  }
  function stage(canvas,medal,interactive=false,notice){return new MedalStage(canvas,{medal,interactive,onFallback:()=>{if(notice){notice.hidden=false;notice.textContent=t('staticSides');}}});}
  function toast(text){clearTimeout(toastTimer);$('#toast').textContent=text;$('#toast').hidden=false;toastTimer=setTimeout(()=>{$('#toast').hidden=true;},4200);}
  function renderCards(){
    stages.forEach(s=>s.dispose());stages.clear();$('#collection-grid').replaceChildren();
    for(const m of state.medals){const el=document.createElement('button');el.type='button';el.className=`medal-card od-tile${m.locked?' medal-locked':''}`;el.dataset.medal=m.id;
      el.setAttribute('aria-label',t('cardAria',{preview:m.preview?t('previewPrefix'):'',name:m.name,status:m.locked?t('locked'):m.preview?t('earnedStyle'):t('earnedCount',{count:m.records.length})}));
      const c=state.snapshot.challenges.progress[m.id];
      const caption=m.preview?requirement(m):m.locked&&c?(m.metric==='days'?t('daysRatio',{current:i18n.number(c.current),target:i18n.number(c.target)}):c.eligible?`${fmt(c.current)} / ${fmt(c.target)}`:t('waitBaseline')):m.design!=='numeric'?requirement(m):'';
      const label=m.preview?t('previewStateLabel',{state:t(m.locked?'unearned':'earned')}):m.locked?t('locked'):`× ${m.records.length}`;
      el.innerHTML=`<div class="medal-art"><canvas aria-hidden="true"></canvas><span class="card-label">${icon(m.locked?'lock':'check')}<span>${esc(label)}</span></span></div><div class="medal-info od-field"><span class="medal-name">${esc(m.name)}</span><span class="medal-meta">${esc(series(m.series))} · ${grade(m.grade)}</span>${caption?`<span class="card-progress">${esc(caption)}</span>`:''}</div>`;
      $('#collection-grid').append(el);stages.set(m.id,stage(el.querySelector('canvas'),m));el.addEventListener('click',()=>openDetail(m.id));
    }
    const fresh=state.medals,unlocked=fresh.filter(m=>!m.locked).length;
    $('#unlocked-count').textContent=unlocked;$('#total-count').textContent=fresh.length;$('#tab-count').textContent=unlocked;
    $('#collection-summary').textContent=state.debug?t('debugSummary',{state:t(state.debug==='earned'?'allEarned':'allLocked')}):t('collectionSummary',{count:i18n.number(unlocked),awards:i18n.number(awards().length),tokens:fmt(state.snapshot.total)});
    $('#reveal-trigger').hidden=state.debug!==null||!state.snapshot.challenges.unseen.length;$('#reveal-trigger-label').textContent=t('revealCount',{count:state.snapshot.challenges.unseen.length});
    const earned=fresh.filter(m=>!m.locked).sort((a,b)=>b.records[0].earnedOn.localeCompare(a.records[0].earnedOn)||b.records[0].serial.localeCompare(a.records[0].serial));
    const hero=earned.find(m=>m.design!=='numeric')||earned[0]||fresh[0],latest=hero.records[0];state.hero=hero.id;
    $('#hero-name').textContent=hero.name;
    $('#hero-description').textContent=hero.locked?requirement(hero):hero.inscription;
    $('#hero-date').textContent=hero.preview?t('previewHero'):latest?t('heroDate',{date:date(latest.earnedOn),count:hero.records.length}):progressText(hero);
    $('#hero-visual-open').setAttribute('aria-label',t(hero.locked?'heroAriaLocked':'heroAriaEarned',{name:hero.name}));
    $('.stage-caption span:last-child').textContent=t(hero.locked?'unlockHint':'touchHint');
    $('#hero-fallback').hidden=true;if(!heroStage)heroStage=stage($('#hero-canvas'),hero,false,$('#hero-fallback'));else heroStage.setMedal(hero);
    applyFilter(state.filter);
  }
  function applyFilter(filter){state.filter=filter;$$('[data-filter]').forEach(b=>{b.classList.toggle('active',b.dataset.filter===filter);b.setAttribute('aria-pressed',String(b.dataset.filter===filter));});$$('#collection-grid [data-medal]').forEach(el=>{el.hidden=filter!=='all'&&state.medals.find(m=>m.id===el.dataset.medal).series!==filter;if(!el.hidden)stages.get(el.dataset.medal).draw();});}
  function setView(view){if(!state.snapshot)return;state.view=view;$('#collection-view').hidden=view!=='collection';$('#progress-view').hidden=view!=='progress';$$('[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===view);b.setAttribute('aria-selected',String(b.dataset.view===view));b.tabIndex=b.dataset.view===view?0:-1;});if(view==='progress')renderProgress();else{heroStage.draw();stages.forEach(s=>s.draw());}}
  function renderProgress(){
    $('#progress-title').textContent=t({day:'todayTitle',week:'weekTitle',month:'monthTitle',lifetime:'lifetimeTitle'}[state.period]);
    $('#period-dates').textContent=t('periodDates',{today:date(state.snapshot.today),zone:state.snapshot.timeZone,enabled:date(state.snapshot.challenges.enabledOn)});
    $$('[data-period]').forEach(b=>{b.classList.toggle('active',b.dataset.period===state.period);b.setAttribute('aria-pressed',String(b.dataset.period===state.period));});
    progressStages.forEach(s=>s.dispose());progressStages=[];$('#task-list').replaceChildren();
    state.medals.filter(m=>m.unit===state.period).forEach(m=>{const c=state.snapshot.challenges.progress[m.id],el=document.createElement('article');el.className='task';el.dataset.medal=m.id;
      const amount=m.metric==='days'?`${c.current}`:m.metric==='growth'?(c.eligible?`${i18n.number((c.current/c.previous-1)*100,{minimumFractionDigits:1,maximumFractionDigits:1})}%`:'—'):fmt(c.current);
      el.innerHTML=`<div class="task-art"><canvas aria-hidden="true"></canvas></div><div class="task-content"><div class="task-heading"><div><div class="task-category">${esc(series(m.series))} · ${esc(grade(m.grade))}</div><h3 class="task-name">${esc(m.name)}</h3></div><div class="task-numbers"><strong>${esc(amount)}</strong>${m.metric==='growth'?`<small>${esc(t('growthNumbers',{current:fmt(c.current),previous:fmt(c.previous)}))}</small>`:`<span>/ ${esc(m.metric==='days'?i18n.number(c.target):fmt(c.target))}</span><small>${m.metric==='days'?esc(t('daysUnit')):'tokens'}</small>`}</div></div><p class="task-description">${esc(requirement(m))}</p>${c.percent===null?'':`<div class="progress-track" role="progressbar" aria-label="${esc(t('progressAria',{name:m.name}))}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(c.percent)}"><div class="progress-fill" style="width:${c.percent}%"></div></div>`}<div class="task-status">${icon(c.earned?'check':'clock')}<span>${esc(progressText(m))}</span></div></div><div class="task-action"><button class="outline-button" type="button" aria-label="${esc(t('cardAria',{preview:'',name:m.name,status:requirement(m)}))}" title="${esc(t('viewMedal'))}"><span>${esc(t('viewMedal'))}</span>${icon('arrow')}</button></div>`;
      $('#task-list').append(el);progressStages.push(stage(el.querySelector('canvas'),m));el.querySelector('button').addEventListener('click',()=>openDetail(m.id));
    });
  }
  function openDetail(id){
    const m=state.medals.find(m=>m.id===id);if(!m)return;state.selected=id;lastFocus=document.activeElement;
    $('#detail-title').textContent=m.name;$('#detail-description').textContent=t('craft.'+(m.design||m.id))!=='craft.'+(m.design||m.id)?t('craft.'+(m.design||m.id)):t('numericDescription');
    $('#detail-status').innerHTML=icon(m.locked?'lock':'check')+`<span>${m.preview?t('detailPreviewState',{state:t(m.locked?'unearned':'earned')}):m.locked?t('notUnlocked'):t('permanentCount',{count:m.records.length})}</span>`;
    $('#detail-requirement').innerHTML=`<strong>${esc(requirement(m))}</strong><span>${esc(m.preview?t('previewProgress'):progressText(m))}</span>`;$('#records-heading').textContent=t(m.preview?'stylePreview':m.locked?'howToEarn':'records');
    $('#detail-records').innerHTML=m.preview?`<p class="detail-description">${esc(t('previewRecords'))}</p>`:m.locked?`<p class="detail-description">${esc(t('lockedRecords'))}</p>`:m.records.map((a,i)=>`<button type="button" class="record record-select" data-record="${i}" aria-pressed="${i===0}"><span class="record-icon">${icon('medal')}</span><span class="od-field"><span class="record-title">${esc(recordsLabel(a))}</span><span class="record-date">${esc(t('recordDate',{date:date(a.earnedOn),backfilled:a.backfilled?t('backfilled'):''}))}</span></span><span class="record-number">#${esc(a.serial)}</span></button>`).join('');
    $('.rotate-controls').hidden=m.locked;$('#rotation-instructions').hidden=m.locked;$('#detail-canvas').tabIndex=m.locked?-1:0;
    $('#detail-canvas').setAttribute('aria-label',t(m.locked?'lockedCanvas':'earnedCanvas',{name:m.name}));$('#detail-canvas').classList.toggle('outline-only',m.locked);$('#detail-progress').hidden=m.preview;
    $('#detail-fallback').hidden=true;$('#detail-dialog').showModal();document.body.style.overflow='hidden';
    if(!detailStage)detailStage=stage($('#detail-canvas'),m,true,$('#detail-fallback'));else detailStage.setMedal(m);
    if(detailStage.fallback&&!m.locked)$('#detail-fallback').hidden=false;
    $$('[data-record]').forEach(b=>b.addEventListener('click',()=>{const a=m.records[+b.dataset.record];detailStage.setMedal({...m,period:recordsLabel(a),serial:a.serial});$$('[data-record]').forEach(o=>o.setAttribute('aria-pressed',String(o===b)));}));
    $$('[data-orient]').forEach(b=>{b.classList.toggle('active',b.dataset.orient==='reset');b.setAttribute('aria-pressed',String(b.dataset.orient==='reset'));});$('#detail-close').focus();
  }
  function accept(data){const {updatedAt,...content}=data,signature=JSON.stringify(content);state.snapshot=data;$('#debug-toggle').disabled=false;if(state.signature===signature)return;state.signature=signature;rebuild();}
  async function load(){
    if(loading)return;loading=true;
    try {const response=await fetch('/api/dsh-medals/status',{cache:'no-store'});const data=await response.json();if(response.status===401)throw Object.assign(new Error(t('apiAuth')),{localized:true});if(!data.challenges)throw Object.assign(new Error(apiError(data.errorCode)||t('syncFailed')),{localized:true});accept(data);
      renderSyncStatus();
    }catch(e){$('#sync-status').hidden=false;$('#sync-status').textContent=t('syncError',{error:e.localized?e.message:t('apiNetwork')});$('#sync-retry').hidden=false;}finally{loading=false;}
  }
  function reveal(){if(state.debug!==null)return;const a=awards().find(a=>state.snapshot.challenges.unseen.includes(a.id));if(!a)return;const m=state.medals.find(m=>m.id===a.ruleId);state.revealing=a;lastFocus=document.activeElement;$('#reveal-title').textContent=m.name;$('#reveal-description').textContent=t('revealDescription',{date:date(a.earnedOn),requirement:requirement(m),serial:a.serial});$('#reveal-canvas').setAttribute('aria-label',t('revealAria',{name:m.name}));$('#reveal-fallback').hidden=true;$('#reveal-dialog').showModal();document.body.style.overflow='hidden';const specimen={...m,period:recordsLabel(a),serial:a.serial};if(!revealStage)revealStage=stage($('#reveal-canvas'),specimen,true,$('#reveal-fallback'));else revealStage.setMedal(specimen);$('#reveal-close').focus();}
  async function closeReveal(detail=false){const a=state.revealing;if(!a)return;state.revealing=null;$('#reveal-dialog').close();try{const r=await fetch('/api/dsh-medals/challenges/ack',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({ids:[a.id]})});if(!r.ok)throw new Error();await load();}catch{toast(t('ackFailed'));}if(detail)openDetail(a.ruleId);}
  function closed(stage){document.body.style.overflow='';stage?.cancel();if(lastFocus?.isConnected)lastFocus.focus({preventScroll:true});}
  $('#hero-open').addEventListener('click',()=>openDetail(state.hero));$('#hero-visual-open').addEventListener('click',()=>openDetail(state.hero));
  $$('[data-view]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));$$('[data-filter]').forEach(b=>b.addEventListener('click',()=>applyFilter(b.dataset.filter)));$$('[data-period]').forEach(b=>b.addEventListener('click',()=>{state.period=b.dataset.period;renderProgress();}));
  $('#debug-toggle').addEventListener('click',()=>setDebug(state.debug===null?'earned':null));
  $$('[data-debug-state]').forEach(button=>button.addEventListener('click',()=>setDebug(button.dataset.debugState)));
  $('#detail-close').addEventListener('click',()=>$('#detail-dialog').close());$('#detail-dialog').addEventListener('close',()=>closed(detailStage));
  $('#detail-progress').addEventListener('click',()=>{state.period=state.medals.find(m=>m.id===state.selected).unit;$('#detail-dialog').close();setView('progress');$('#progress-title').focus();});
  $$('[data-orient]').forEach(b=>b.addEventListener('click',()=>{detailStage?.orient(b.dataset.orient);$$('[data-orient]').forEach(o=>{o.classList.toggle('active',o===b);o.setAttribute('aria-pressed',String(o===b));});}));
  $('#reveal-trigger').addEventListener('click',reveal);$('#reveal-close').addEventListener('click',()=>closeReveal());$('#reveal-later').addEventListener('click',()=>closeReveal());$('#reveal-view').addEventListener('click',()=>closeReveal(true));
  $('#reveal-dialog').addEventListener('cancel',e=>{e.preventDefault();void closeReveal();});$('#reveal-dialog').addEventListener('close',()=>closed(revealStage));
  for(const d of [$('#detail-dialog'),$('#reveal-dialog')])d.addEventListener('click',e=>{if(e.target!==d)return;const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom){if(d.id==='reveal-dialog')void closeReveal();else d.close();}});
  $$('.content-tabs .tab').forEach((b,i,all)=>b.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();const next=all[(i+(e.key==='ArrowRight'?1:-1)+all.length)%all.length];next.focus();setView(next.dataset.view);}));
  function apiError(code){return code?t({SYNC_FAILED:'apiSyncRetained',UNAVAILABLE:'apiUnavailable',ACK_FAILED:'apiAckFailed'}[code]||'syncFailed'):'';}
  function renderSyncStatus(){
    const data=state.snapshot;if(!data)return;
    const status=$('#sync-status');status.hidden=data.complete&&!data.excludedSessions;
    status.textContent=apiError(data.errorCode)||(!data.complete?t('syncIncomplete',{count:data.failedSessions}):t('syncExcluded',{excluded:data.excludedSessions,count:data.sessionCount}));
    $('#sync-retry').hidden=data.complete;
    $('.footer-status').textContent=t('sessionStatus',{zone:data.timeZone,count:i18n.number(data.sessionCount),archived:data.archivedSessions?t('archived',{count:i18n.number(data.archivedSessions)}):''});
  }
  function localize(){
    document.documentElement.lang=i18n.locale==='zh'?'zh-CN':'en';document.title=t('nav')+' · DSH Medals';
    document.querySelector('meta[name="description"]').content=t('heroCopy');
    $$('[data-i18n]').forEach(el=>{el.textContent=t(el.dataset.i18n);});
    $$('[data-i18n-label]').forEach(el=>{el.setAttribute('aria-label',t(el.dataset.i18nLabel));});
    $('#debug-toggle').textContent=t(state.debug===null?'debugOpen':'debugExit');
  }
  function setLocale(value){
    const previous=i18n.locale;i18n.setLocale(value);if(previous===i18n.locale)return;
    localize();if(!state.snapshot)return;
    const detailOpen=$('#detail-dialog').open,revealOpen=$('#reveal-dialog').open,selected=state.selected;
    rebuild();renderSyncStatus();if(detailOpen)openDetail(selected);if(revealOpen)reveal();
  }
  window.addEventListener('message',event=>{
    if(event.source!==window.parent||event.origin!==location.origin||window.parent===window)return;
    if(event.data?.type==='dsh-medals:locale')setLocale(event.data.locale);
    if(event.data?.type==='dsh-medals:navigation')$('#return-session').hidden=event.data.canReturn!==true;
  });
  $('#return-session').addEventListener('click',()=>window.parent.postMessage({type:'dsh-medals:return'},location.origin));
  $('#sync-retry').addEventListener('click',load);window.addEventListener('focus',load);document.addEventListener('visibilitychange',()=>{if(!document.hidden)void load();});
  setInterval(()=>{if(!document.hidden&&!$('#detail-dialog').open&&!$('#reveal-dialog').open)void load();},30_000);
  window.addEventListener('pagehide',()=>{stages.forEach(s=>s.dispose());heroStage?.dispose();detailStage?.dispose();revealStage?.dispose();progressStages.forEach(s=>s.dispose());});
  localize();void load();
})();
