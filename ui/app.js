(() => {
  'use strict';
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const paths={medal:'<circle cx="12" cy="14" r="6"/><path d="m8 9-3-6h5l2 4 2-4h5l-3 6M10 14l1.5 1.5 3-3"/>',arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>',check:'<path d="m5 12 4 4L19 6"/>',lock:'<rect x="6" y="10" width="12" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v2"/>',clock:'<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>',reset:'<path d="M4 10a8 8 0 1 1 1 7M4 4v6h6"/>',info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-9v.1"/>',spin:'<path d="M5 8C1 11 3 17 12 17s11-6 7-9M9 3l3 3-3 3m3-3H5m4 11 3 3 3-3"/>',close:'<path d="m6 6 12 12M18 6 6 18"/>',replay:'<path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.6M4 4v4.6h4.6"/><path d="m10.5 9.5 4 2.5-4 2.5z"/>'};
  const icon=n=>`<svg viewBox="0 0 24 24" aria-hidden="true">${paths[n]||paths.medal}</svg>`;
  $$('[data-icon]').forEach(el=>{el.innerHTML=icon(el.dataset.icon);});
  const i18n=MedalsI18n.createI18n(new URL(location.href).searchParams.get('lang')||navigator.language);
  const t=i18n.t,date=value=>i18n.date(value),series=key=>t('series.'+key),grade=key=>t('grade.'+key);
  const fmt=n=>n>=1e9?`${i18n.number(n/1e9,{maximumFractionDigits:2})}B`:n>=1e6?`${i18n.number(n/1e6,{maximumFractionDigits:2})}M`:n>=1e3?`${i18n.number(n/1e3,{maximumFractionDigits:1})}K`:i18n.number(n??0);
  const state={view:'collection',period:'day',hero:null,selected:null,snapshot:null,medals:[],reveal:null,debug:null,record:0,pendingAuto:true};
  const stages=new Map();let heroStage,detailStage,revealStage,progressStages=[],lastFocus,loading=false,toastTimer,revealToken=0,dustFrame=0;
  const pendingAcks=[];
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
    rebuild();if(mode!==null)scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
  }
  function stage(canvas,medal,interactive=false,notice,autoSpin=false){return new MedalStage(canvas,{medal,interactive,autoSpin,onFallback:()=>{if(notice){notice.hidden=false;notice.textContent=t('staticSides');}}});}
  function toast(text){clearTimeout(toastTimer);$('#toast').textContent=text;$('#toast').hidden=false;toastTimer=setTimeout(()=>{$('#toast').hidden=true;},4200);}
  // Shelves group the collection by series, in challenge order, so progression reads left to right.
  const SHELVES=[['daily',['daily']],['period',['weekly','monthly']],['days',['days']],['milestones',['tokens','volume','growth']]];
  function lockedCaption(m){
    const c=state.snapshot.challenges.progress[m.id];if(!c)return requirement(m);
    if(m.metric==='days')return t('daysRatio',{current:i18n.number(c.current),target:i18n.number(c.target)});
    return c.eligible?`${fmt(c.current)} / ${fmt(c.target)}`:t('waitBaseline');
  }
  // Locked medals closest to unlocking, best first.
  function nearest(limit=2){
    if(state.debug!==null)return [];
    const progress=state.snapshot.challenges.progress;
    return state.medals.filter(m=>m.locked).map(m=>({m,c:progress[m.id]})).filter(({c})=>c&&c.eligible!==false&&c.percent!=null&&c.percent>0&&c.percent<100).sort((a,b)=>b.c.percent-a.c.percent).slice(0,limit).map(({m})=>m);
  }
  function card(m,near){
    const el=document.createElement('button');el.type='button';el.className=`medal-card od-tile${m.locked?' medal-locked':''}${near?' medal-near':''}`;el.dataset.medal=m.id;
    el.setAttribute('aria-label',t('cardAria',{preview:m.preview?t('previewPrefix'):'',name:m.name,status:m.locked?t('locked'):m.preview?t('earnedStyle'):t('earnedCount',{count:m.records.length})}));
    const c=state.snapshot.challenges.progress[m.id];
    let status;
    if(m.preview)status=`<span class="medal-meta">${esc(t('previewStateLabel',{state:t(m.locked?'unearned':'earned')}))}</span>`;
    else if(!m.locked)status=`<span class="medal-meta medal-earned">${icon('check')}<span>${esc(t('earnedTimes',{count:m.records.length}))}</span></span>`;
    else status=`${c?.percent!=null&&c.eligible!==false?`<span class="card-bar" aria-hidden="true"><span style="width:${Math.max(2,Math.min(100,c.percent))}%"></span></span>`:''}<span class="medal-meta">${esc(lockedCaption(m))}</span>`;
    el.innerHTML=`<div class="medal-art"><canvas aria-hidden="true"></canvas>${near?`<span class="card-flag">${esc(t('nearUnlock'))}</span>`:''}</div><div class="medal-info od-field"><span class="medal-name">${esc(m.name)}</span>${status}</div>`;
    el.addEventListener('click',()=>openDetail(m.id));
    return el;
  }
  function renderCards(){
    stages.forEach(s=>s.dispose());stages.clear();$('#collection-grid').replaceChildren();
    const near=new Set(nearest().map(m=>m.id));
    for(const [key,series] of SHELVES){
      const items=state.medals.filter(m=>series.includes(m.series));if(!items.length)continue;
      const shelf=document.createElement('section');shelf.className='shelf';shelf.setAttribute('aria-label',t('shelf.'+key));
      const earned=items.filter(m=>!m.locked).length;
      shelf.innerHTML=`<header class="shelf-head"><h3>${esc(t('shelf.'+key))}</h3><span class="shelf-count${earned===items.length?' complete':''}">${i18n.number(earned)} / ${i18n.number(items.length)}</span></header><div class="shelf-grid od-grid"></div>`;
      const grid=shelf.querySelector('.shelf-grid');
      for(const m of items){const el=card(m,near.has(m.id));grid.append(el);stages.set(m.id,stage(el.querySelector('canvas'),m));}
      $('#collection-grid').append(shelf);
    }
    const fresh=state.medals,unlocked=fresh.filter(m=>!m.locked).length,pending=state.debug===null?state.snapshot.challenges.unseen.length:0;
    $('#unlocked-count').textContent=unlocked;$('#total-count').textContent=fresh.length;$('#tab-count').textContent=unlocked;
    $('#collection-summary').textContent=state.debug?t('debugSummary',{state:t(state.debug==='earned'?'allEarned':'allLocked')}):t('collectionSummary',{count:i18n.number(unlocked),awards:i18n.number(awards().length),tokens:fmt(state.snapshot.total)});
    $('#reveal-trigger').hidden=!pending;$('#reveal-trigger-label').textContent=t('revealPending',{count:i18n.number(pending)});
    const earned=fresh.filter(m=>!m.locked).sort((a,b)=>b.records[0].earnedOn.localeCompare(a.records[0].earnedOn)||b.records[0].serial.localeCompare(a.records[0].serial));
    // The featured stage cycles through every earned medal, newest first.
    const list=earned.length?earned:[fresh[0]],keep=list.findIndex(m=>m.id===state.hero);
    state.heroList=list.map(m=>m.id);renderHeroNav();showHero(keep>=0?keep:0);scheduleHero();
    const next=nearest(1)[0];$('#hero-next').hidden=!next;
    if(next){const c=state.snapshot.challenges.progress[next.id];state.next=next.id;$('#hero-next-name').textContent=next.name;$('#hero-next-fill').style.width=`${Math.max(2,Math.min(100,c.percent))}%`;$('#hero-next-text').textContent=progressText(next);$('#hero-next').setAttribute('aria-label',`${t('nextGoal')} · ${next.name} · ${progressText(next)}`);}
  }
  const reducedMotion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
  let heroTimer=0,heroToken=0,heroHover=false,heroSwiped=false;
  function renderHeroNav(){
    const list=state.heroList,multi=list.length>1;$('#hero-nav').hidden=!multi;$('#hero-caption').hidden=multi;
    $('#hero-dots').hidden=list.length>12;
    $('#hero-dots').innerHTML=multi&&list.length<=12?list.map((id,i)=>`<button type="button" class="hero-dot" data-hero="${i}" aria-label="${esc(t('showMedal',{name:state.medals.find(m=>m.id===id).name}))}"></button>`).join(''):'';
    $$('[data-hero]').forEach(b=>b.addEventListener('click',()=>{const i=+b.dataset.hero;if(i!==state.heroIndex)showHero(i,i>state.heroIndex?1:-1);scheduleHero();}));
  }
  function fillHero(m){
    const list=state.heroList,latest=m.records[0];
    $('#hero-kicker').textContent=m.preview?t('heroPreview'):m.locked?t('heroFirst'):list.length>1?t('heroSlide',{index:i18n.number(state.heroIndex+1),count:i18n.number(list.length)}):t('heroRecent');
    $('#hero-name').textContent=m.name;
    $('#hero-description').textContent=m.locked?requirement(m):m.inscription;
    $('#hero-date').textContent=m.preview?t('previewHero'):latest?t('heroDate',{date:date(latest.earnedOn),count:m.records.length}):progressText(m);
    $('#hero-visual-open').setAttribute('aria-label',t(m.locked?'heroAriaLocked':'heroAriaEarned',{name:m.name}));
    $('#hero-caption span:last-child').textContent=t(m.locked?'unlockHint':'touchHint');
    $('#hero-fallback').hidden=true;if(!heroStage)heroStage=stage($('#hero-canvas'),m,false,$('#hero-fallback'));else heroStage.setMedal(m);
  }
  // dir: 1 = forward (slides out left), -1 = back, 0 = no transition.
  function showHero(index,dir=0){
    const list=state.heroList;index=(index+list.length)%list.length;state.heroIndex=index;
    const m=state.medals.find(x=>x.id===list[index]);state.hero=m.id;
    $$('[data-hero]').forEach(b=>b.setAttribute('aria-current',String(+b.dataset.hero===index)));
    const slides=$$('.hero-slide'),token=++heroToken;
    slides.forEach(el=>el.classList.remove('out-left','out-right','in-left','in-right'));
    if(!dir||reducedMotion()||!heroStage)return fillHero(m);
    slides.forEach(el=>el.classList.add(dir>0?'out-left':'out-right'));
    setTimeout(()=>{
      if(token!==heroToken)return;fillHero(m);
      slides.forEach(el=>{el.classList.remove('out-left','out-right');el.classList.add('no-anim',dir>0?'in-right':'in-left');});
      void $('#hero').offsetWidth;slides.forEach(el=>el.classList.remove('no-anim','in-left','in-right'));
    },260);
  }
  const heroPaused=()=>document.hidden||state.view!=='collection'||heroHover||$('#hero').matches(':focus-within')||!!document.querySelector('dialog[open]');
  function scheduleHero(){
    clearTimeout(heroTimer);if((state.heroList?.length??0)<2||reducedMotion())return;
    heroTimer=setTimeout(()=>{if(!heroPaused())showHero(state.heroIndex+1,1);scheduleHero();},6000);
  }
  function setView(view){if(!state.snapshot)return;state.view=view;$('#collection-view').hidden=view!=='collection';$('#progress-view').hidden=view!=='progress';$$('[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===view);b.setAttribute('aria-selected',String(b.dataset.view===view));b.tabIndex=b.dataset.view===view?0:-1;});if(view==='progress')renderProgress();else{heroStage.draw();stages.forEach(s=>s.draw());}}
  function renderProgress(){
    $('#progress-title').textContent=t({day:'todayTitle',week:'weekTitle',month:'monthTitle',lifetime:'lifetimeTitle'}[state.period]);
    $('#period-dates').textContent=t('periodDates',{today:date(state.snapshot.today),zone:state.snapshot.timeZone,enabled:date(state.snapshot.challenges.enabledOn)});
    $$('[data-period]').forEach(b=>{b.classList.toggle('active',b.dataset.period===state.period);b.setAttribute('aria-pressed',String(b.dataset.period===state.period));});
    progressStages.forEach(s=>s.dispose());progressStages=[];$('#task-list').replaceChildren();
    // Open challenges first; completed ones collapse into compact rows below.
    const progress=state.snapshot.challenges.progress,items=state.medals.filter(m=>m.unit===state.period);
    const open=items.filter(m=>!progress[m.id].earned),done=items.filter(m=>progress[m.id].earned);
    for(const m of open){const c=progress[m.id],el=document.createElement('article');el.className='task';el.dataset.medal=m.id;
      const amount=m.metric==='days'?`${c.current}`:m.metric==='growth'?(c.eligible?`${i18n.number((c.current/c.previous-1)*100,{minimumFractionDigits:1,maximumFractionDigits:1})}%`:'—'):fmt(c.current);
      el.innerHTML=`<div class="task-art"><canvas aria-hidden="true"></canvas></div><div class="task-content"><div class="task-heading"><div><div class="task-category">${esc(series(m.series))} · ${esc(grade(m.grade))}</div><h3 class="task-name">${esc(m.name)}</h3></div><div class="task-numbers"><strong>${esc(amount)}</strong>${m.metric==='growth'?`<small>${esc(t('growthNumbers',{current:fmt(c.current),previous:fmt(c.previous)}))}</small>`:`<span>/ ${esc(m.metric==='days'?i18n.number(c.target):fmt(c.target))}</span><small>${m.metric==='days'?esc(t('daysUnit')):'tokens'}</small>`}</div></div><p class="task-description">${esc(requirement(m))}</p>${c.percent===null?'':`<div class="progress-track" role="progressbar" aria-label="${esc(t('progressAria',{name:m.name}))}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(c.percent)}"><div class="progress-fill" style="width:${c.percent}%"></div></div>`}<div class="task-status">${icon('clock')}<span>${esc(progressText(m))}</span></div></div><div class="task-action"><button class="outline-button" type="button" aria-label="${esc(t('cardAria',{preview:'',name:m.name,status:requirement(m)}))}" title="${esc(t('viewMedal'))}"><span>${esc(t('viewMedal'))}</span>${icon('arrow')}</button></div>`;
      $('#task-list').append(el);progressStages.push(stage(el.querySelector('canvas'),m));el.querySelector('button').addEventListener('click',()=>openDetail(m.id));
    }
    if(!open.length&&done.length){const all=document.createElement('p');all.className='task-all-done';all.textContent=t('allDone');$('#task-list').append(all);}
    if(done.length){const head=document.createElement('h3');head.className='task-group';head.innerHTML=`${icon('check')}<span>${esc(t('doneHeading',{count:i18n.number(done.length)}))}</span>`;$('#task-list').append(head);}
    for(const m of done){const el=document.createElement('article');el.className='task task-done';el.dataset.medal=m.id;
      el.innerHTML=`<div class="task-art"><canvas aria-hidden="true"></canvas></div><div class="task-content"><h3 class="task-name">${esc(m.name)}</h3><p class="task-description">${esc(requirement(m))}</p></div><button class="text-button task-view" type="button" aria-label="${esc(t('cardAria',{preview:'',name:m.name,status:t('periodEarned')}))}"><span>${esc(t('viewMedal'))}</span>${icon('arrow')}</button>`;
      $('#task-list').append(el);progressStages.push(stage(el.querySelector('canvas'),m));el.querySelector('button').addEventListener('click',()=>openDetail(m.id));
    }
  }
  function openDetail(id){
    const m=state.medals.find(m=>m.id===id);if(!m)return;state.selected=id;if(!document.activeElement?.closest('dialog'))lastFocus=document.activeElement;
    $('#detail-title').textContent=m.name;$('#detail-description').textContent=t('craft.'+(m.design||m.id))!=='craft.'+(m.design||m.id)?t('craft.'+(m.design||m.id)):t('numericDescription');
    $('#detail-kicker').textContent=m.preview?t('detailPreviewState',{state:t(m.locked?'unearned':'earned')}):`${series(m.series)} · ${grade(m.grade)}`;
    // One facts card: the requirement, then either the earned summary or live progress.
    const c=state.snapshot.challenges.progress[m.id],first=m.records[m.records.length-1];
    const facts=m.preview?`<p class="fact-state">${esc(t('previewProgress'))}</p>`:!m.locked?`<p class="fact-state earned">${icon('check')}<span>${esc(t('earnedSince',{count:i18n.number(m.records.length),date:date(first.earnedOn)}))}</span></p>`:`${c?.percent!=null&&c.eligible!==false?`<span class="fact-bar" role="progressbar" aria-label="${esc(t('progressAria',{name:m.name}))}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(c.percent)}"><span style="width:${Math.max(2,Math.min(100,c.percent))}%"></span></span>`:''}<p class="fact-state">${icon('lock')}<span>${esc(progressText(m)||t('notUnlocked'))}</span></p>`;
    $('#detail-requirement').innerHTML=`<span class="fact-label">${esc(t('factRequirement'))}</span><strong>${esc(requirement(m))}</strong>${facts}`;
    $('#detail-records-block').hidden=m.locked||m.preview;$('#records-heading').textContent=t('recordsCount',{count:i18n.number(m.records.length)});
    $('#detail-records').innerHTML=m.locked||m.preview?'':m.records.map((a,i)=>`<button type="button" class="record record-select" data-record="${i}" aria-pressed="${i===0}"><span class="record-icon">${icon('medal')}</span><span class="od-field"><span class="record-title">${esc(recordsLabel(a))}</span><span class="record-date">${esc(t('recordDate',{date:date(a.earnedOn),backfilled:a.backfilled?t('backfilled'):''}))}</span></span><span class="record-number">#${esc(a.serial)}</span></button>`).join('');
    state.record=0;$('.rotate-controls').hidden=m.locked;$('#detail-replay').hidden=m.locked;$('#rotation-instructions').textContent=t(m.locked?'unlockHint':'rotateHint');$('#detail-canvas').tabIndex=m.locked?-1:0;
    $('#detail-canvas').setAttribute('aria-label',t(m.locked?'lockedCanvas':'earnedCanvas',{name:m.name}));$('#detail-canvas').classList.toggle('outline-only',m.locked);$('#detail-progress').hidden=m.preview||!m.locked;
    $('#detail-fallback').hidden=true;$('#detail-dialog').showModal();document.body.style.overflow='hidden';
    if(!detailStage)detailStage=stage($('#detail-canvas'),m,true,$('#detail-fallback'),true);else detailStage.setMedal(m);
    if(detailStage.fallback&&!m.locked)$('#detail-fallback').hidden=false;
    $$('[data-record]').forEach(b=>b.addEventListener('click',()=>{const a=m.records[+b.dataset.record];state.record=+b.dataset.record;detailStage.setMedal({...m,period:recordsLabel(a),serial:a.serial});$$('[data-record]').forEach(o=>o.setAttribute('aria-pressed',String(o===b)));}));
    $$('[data-orient]').forEach(b=>{b.classList.toggle('active',b.dataset.orient==='reset');b.setAttribute('aria-pressed',String(b.dataset.orient==='reset'));});$('#detail-close').focus();
  }
  function accept(data){const {updatedAt,...content}=data,signature=JSON.stringify(content);state.snapshot=data;$('#debug-toggle').disabled=false;if(state.signature===signature)return;state.signature=signature;rebuild();}
  async function load(){
    if(loading)return;loading=true;
    try {const response=await fetch('/api/dsh-medals/status',{cache:'no-store'});const data=await response.json();if(response.status===401)throw Object.assign(new Error(t('apiAuth')),{localized:true});if(!data.challenges)throw Object.assign(new Error(apiError(data.errorCode)||t('syncFailed')),{localized:true});accept(data);
      renderSyncStatus();reportUnseen();maybeAutoReveal();
    }catch(e){$('#sync-status').hidden=false;$('#sync-status').textContent=t('syncError',{error:e.localized?e.message:t('apiNetwork')});$('#sync-retry').hidden=false;}finally{loading=false;}
  }
  // Unseen awards play one by one, oldest first; replays reuse the same stage without acknowledging.
  function reveal(){
    if(state.debug!==null||state.reveal)return;
    const queue=awards().filter(a=>state.snapshot.challenges.unseen.includes(a.id)).sort((a,b)=>a.earnedOn.localeCompare(b.earnedOn)||a.serial.localeCompare(b.serial));
    if(!queue.length)return;
    state.reveal={mode:'new',queue,index:0,acked:new Set()};openReveal();
  }
  function replay(id,record=0){
    const m=state.medals.find(m=>m.id===id);if(!m||m.locked)return;
    const a=m.records[record]||m.records[0],focus=lastFocus;
    state.reveal={mode:'replay',queue:[{...a,ruleId:id}],index:0,acked:new Set()};
    if($('#detail-dialog').open)$('#detail-dialog').close();
    lastFocus=focus;openReveal();
  }
  function openReveal(){
    if(!$('#reveal-dialog').open){if(state.reveal.mode==='new')lastFocus=document.activeElement;$('#reveal-dialog').showModal();document.body.style.overflow='hidden';}
    playReveal();$('#reveal-dialog').focus();
  }
  function revealText(){
    const r=state.reveal;if(!r)return;const a=r.queue[r.index],m=state.medals.find(m=>m.id===a.ruleId);if(!m)return;
    const replaying=r.mode==='replay',last=r.index===r.queue.length-1;
    $('#reveal-kicker').textContent=replaying?t('replayKicker'):r.queue.length>1?t('revealProgress',{index:r.index+1,count:r.queue.length}):t('revealKicker');
    $('#reveal-title').textContent=m.name;
    $('#reveal-description').textContent=a.earnedOn?t('revealDescription',{date:date(a.earnedOn),requirement:requirement(m),serial:a.serial}):requirement(m);
    $('#reveal-canvas').setAttribute('aria-label',t('revealAria',{name:m.name}));
    $('#reveal-next').hidden=replaying||last;$('#reveal-later').hidden=!replaying&&!last;
    $('#reveal-later').textContent=t(replaying?'done':'keep');$('#reveal-note').hidden=replaying;
  }
  function playReveal(){
    const r=state.reveal,a=r.queue[r.index],m=state.medals.find(m=>m.id===a.ruleId),token=++revealToken;
    revealText();$('#reveal-fallback').hidden=true;
    const dialog=$('#reveal-dialog');dialog.classList.remove('landed');stopDust();
    const specimen={...m,period:recordsLabel(a),serial:a.serial};
    if(!revealStage)revealStage=stage($('#reveal-canvas'),specimen,true,$('#reveal-fallback'),true);else revealStage.setMedal(specimen);
    if(revealStage.fallback)$('#reveal-fallback').hidden=false;
    // Force a style flush so the landing flare restarts on replay.
    void dialog.offsetWidth;
    revealStage.playEntrance().then(()=>{if(token!==revealToken||!dialog.open)return;dialog.classList.add('landed');dust();});
  }
  function ackCurrent(){
    const r=state.reveal;if(!r||r.mode!=='new')return;const a=r.queue[r.index];if(r.acked.has(a.id))return;r.acked.add(a.id);
    pendingAcks.push(fetch('/api/dsh-medals/challenges/ack',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({ids:[a.id]})}).then(res=>{if(!res.ok)throw new Error();}));
  }
  function nextReveal(){const r=state.reveal;if(!r||r.index>=r.queue.length-1)return;ackCurrent();r.index++;playReveal();$('#reveal-dialog').focus();}
  async function closeReveal(detail=false){
    const r=state.reveal;if(!r)return;ackCurrent();const a=r.queue[r.index];state.reveal=null;revealToken++;stopDust();$('#reveal-dialog').close();
    if(r.mode==='new'){const results=await Promise.allSettled(pendingAcks.splice(0));if(results.some(x=>x.status==='rejected'))toast(t('ackFailed'));await load();}
    if(detail)openDetail(a.ruleId);
  }
  // A dozen slow gold motes drift out from the medal as it lands, then fade.
  function dust(){
    stopDust();if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const canvas=$('#reveal-dust'),box=canvas.getBoundingClientRect();if(!box.width||!box.height)return;
    const ratio=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(box.width*ratio);canvas.height=Math.round(box.height*ratio);
    const ctx=canvas.getContext('2d'),cx=box.width/2,cy=box.height/2,radius=Math.min(box.width,box.height)*.34;
    const motes=Array.from({length:16},()=>{const a=Math.random()*Math.PI*2,r=radius*(.85+Math.random()*.5),speed=10+Math.random()*22;return{x:cx+Math.cos(a)*r,y:cy+Math.sin(a)*r,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed*.6-6,size:.8+Math.random()*1.5,life:1500+Math.random()*900,phase:Math.random()*6};});
    let start=0;
    const tick=time=>{
      start||=time;const elapsed=time-start,s=elapsed/1000;ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,box.width,box.height);let alive=false;
      ctx.shadowColor='rgba(255,220,150,.9)';ctx.shadowBlur=6;ctx.fillStyle='#ffe2a6';
      for(const p of motes){const k=elapsed/p.life;if(k>=1)continue;alive=true;
        const x=p.x+p.vx*s,y=p.y+p.vy*s+9*s*s,alpha=Math.sin(Math.PI*Math.min(1,k*1.4))*(.55+.45*Math.sin(p.phase+s*5))*(1-k);
        ctx.globalAlpha=Math.max(0,alpha);ctx.beginPath();ctx.arc(x,y,p.size,0,Math.PI*2);ctx.fill();}
      dustFrame=alive?requestAnimationFrame(tick):0;
    };
    dustFrame=requestAnimationFrame(tick);
  }
  function stopDust(){if(dustFrame)cancelAnimationFrame(dustFrame);dustFrame=0;const c=$('#reveal-dust');c.getContext('2d').clearRect(0,0,c.width,c.height);}
  // Plays automatically once each time the panel is opened, never while the gallery is already in use.
  function maybeAutoReveal(){
    if(!state.pendingAuto||!state.snapshot)return;state.pendingAuto=false;
    if(state.debug!==null||$('#detail-dialog').open||$('#reveal-dialog').open)return;
    if(state.snapshot.challenges.unseen.length)reveal();
  }
  function reportUnseen(){if(window.parent!==window&&state.snapshot)window.parent.postMessage({type:'dsh-medals:unseen',count:state.snapshot.challenges.unseen.length},location.origin);}
  function closed(stage){stage?.cancel();if(document.querySelector('dialog[open]'))return;document.body.style.overflow='';if(lastFocus?.isConnected)lastFocus.focus({preventScroll:true});}
  $('#hero-open').addEventListener('click',()=>openDetail(state.hero));$('#hero-next').addEventListener('click',()=>openDetail(state.next));$('#hero-visual-open').addEventListener('click',()=>{if(heroSwiped){heroSwiped=false;return;}openDetail(state.hero);});
  $('#hero-prev').addEventListener('click',()=>{showHero(state.heroIndex-1,-1);scheduleHero();});$('#hero-forward').addEventListener('click',()=>{showHero(state.heroIndex+1,1);scheduleHero();});
  $('#hero').addEventListener('mouseenter',()=>{heroHover=true;});$('#hero').addEventListener('mouseleave',()=>{heroHover=false;});
  // Horizontal swipe on the medal moves between slides; a tap still opens the detail.
  {let start=null;const v=$('#hero-visual-open');v.style.touchAction='pan-y';
   v.addEventListener('pointerdown',e=>{start={x:e.clientX,y:e.clientY};});
   v.addEventListener('pointerup',e=>{if(!start||(state.heroList?.length??0)<2)return;const dx=e.clientX-start.x,dy=e.clientY-start.y;start=null;if(Math.abs(dx)>40&&Math.abs(dx)>Math.abs(dy)){heroSwiped=true;showHero(state.heroIndex+(dx<0?1:-1),dx<0?1:-1);scheduleHero();}});
   v.addEventListener('pointercancel',()=>{start=null;});}
  $$('[data-view]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));$$('[data-period]').forEach(b=>b.addEventListener('click',()=>{state.period=b.dataset.period;renderProgress();}));
  $('#debug-toggle').addEventListener('click',()=>setDebug(state.debug===null?'earned':null));
  $$('[data-debug-state]').forEach(button=>button.addEventListener('click',()=>setDebug(button.dataset.debugState)));
  $('#detail-close').addEventListener('click',()=>$('#detail-dialog').close());$('#detail-dialog').addEventListener('close',()=>closed(detailStage));
  $('#detail-progress').addEventListener('click',()=>{state.period=state.medals.find(m=>m.id===state.selected).unit;$('#detail-dialog').close();setView('progress');$('#progress-title').focus();});
  $$('[data-orient]').forEach(b=>b.addEventListener('click',()=>{detailStage?.orient(b.dataset.orient);$$('[data-orient]').forEach(o=>{o.classList.toggle('active',o===b);o.setAttribute('aria-pressed',String(o===b));});}));
  $('#reveal-trigger').addEventListener('click',reveal);$('#reveal-close').addEventListener('click',()=>closeReveal());$('#reveal-next').addEventListener('click',nextReveal);$('#reveal-replay').addEventListener('click',()=>{if(state.reveal)playReveal();});
  $('#detail-replay').addEventListener('click',()=>replay(state.selected,state.record));$('#reveal-later').addEventListener('click',()=>closeReveal());$('#reveal-view').addEventListener('click',()=>closeReveal(true));
  $('#reveal-dialog').addEventListener('cancel',e=>{e.preventDefault();void closeReveal();});$('#reveal-dialog').addEventListener('close',()=>{stopDust();closed(revealStage);});
  $('#detail-dialog').addEventListener('click',e=>{const d=$('#detail-dialog');if(e.target!==d)return;const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom){$('#detail-dialog').close();}});
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
    const detailOpen=$('#detail-dialog').open,selected=state.selected;
    rebuild();renderSyncStatus();if(detailOpen)openDetail(selected);revealText();
  }
  window.addEventListener('message',event=>{
    if(event.source!==window.parent||event.origin!==location.origin||window.parent===window)return;
    if(event.data?.type==='dsh-medals:locale')setLocale(event.data.locale);
    if(event.data?.type==='dsh-medals:navigation')$('#return-session').hidden=event.data.canReturn!==true;
    if(event.data?.type==='dsh-medals:opened'){state.pendingAuto=true;maybeAutoReveal();}
  });
  $('#return-session').addEventListener('click',()=>window.parent.postMessage({type:'dsh-medals:return'},location.origin));
  $('#sync-retry').addEventListener('click',load);window.addEventListener('focus',load);document.addEventListener('visibilitychange',()=>{if(!document.hidden)void load();});
  setInterval(()=>{if(!document.hidden&&!$('#detail-dialog').open&&!$('#reveal-dialog').open)void load();},30_000);
  window.addEventListener('pagehide',()=>{stages.forEach(s=>s.dispose());heroStage?.dispose();detailStage?.dispose();revealStage?.dispose();progressStages.forEach(s=>s.dispose());});
  localize();void load();
})();
