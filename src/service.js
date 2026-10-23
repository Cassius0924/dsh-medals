import {localDate} from './calendar.js';
import {foldUsage,safeAdd} from './usage.js';
import {RULES} from './awards.js';
import {CHALLENGES,createChallenges,settleChallenges,challengeProgress,DAILY_TARGET} from './challenges.js';

function aggregateDaily(state){
  const daily={};
  for(const session of Object.values(state.sessions))for(const [day,n] of Object.entries(session.daily))daily[day]=safeAdd(daily[day]??0,n);
  return daily;
}
function ledgerView(state,daily,today){
  const total=Object.entries(daily).filter(([d])=>d<=today).map(([,n])=>n).reduce(safeAdd,0);
  const challengeState=state.challenges;
  const challenges=challengeState?{version:challengeState.version,initialized:challengeState.initialized,enabledOn:challengeState.enabledOn,awards:challengeState.awards,completedDays:challengeState.completedDays,rules:CHALLENGES,progress:challengeProgress(daily,challengeState,today),dailyTarget:DAILY_TARGET,unseen:challengeState.awards.filter(a=>!a.seen).map(a=>a.id)}:null;
  return{challenges,timeZone:state.timeZone,today,total,daily,awards:state.awards,unseen:state.awards.filter(a=>!a.seen).map(a=>a.id),rules:RULES};
}

export class MedalsService {
  constructor({persistence,ledger,clock=Date.now}) {
    this.persistence=persistence;this.ledger=ledger;this.clock=clock;
    this.revisions=new Map();this.pending=null;this.latest=null;this.tail=Promise.resolve();
  }
  enqueue(work) {const result=this.tail.then(work);this.tail=result.catch(()=>{});return result;}
  refresh() {
    if (!this.pending) this.pending=this.enqueue(()=>this.scan()).finally(()=>{this.pending=null;});
    return this.pending;
  }
  async scan() {
    const snapshots=await this.persistence.list();
    const nextRevisions=new Map(this.revisions);
    const result=await this.ledger.update(async state=>{
      const failures=[], excluded=[];
      const active=new Set();
      for (const snapshot of snapshots) {
        const id=snapshot.header.id;
        if (typeof id!=='string' || ['__proto__','constructor','prototype'].includes(id)) throw new Error('Invalid session id');
        active.add(id);
        if (this.revisions.has(id) && this.revisions.get(id)===snapshot.revision && state.sessions[id]) continue;
        try {
          const handle=await this.persistence.open(id,'read');
          try {
          const events=[];
          for (let offset=0;;) {
            const page=await handle.read(offset,512);
            if (!page.events.length) break;
            events.push(...page.events); offset+=page.events.length;
          }
          state.sessions[id]={daily:foldUsage(events,{timeZone:state.timeZone,inheritedEventCount:handle.inheritedEventCount})};
          nextRevisions.set(id,snapshot.revision);
          } finally {await handle.close();}
        } catch(error) {
          if(error?.name==='SessionFormatUnsupportedError')excluded.push(id);else failures.push(id);
          nextRevisions.delete(id);
        }
      }
      const daily=aggregateDaily(state);
      const today=localDate(this.clock(),state.timeZone);
      state.challenges??=createChallenges(today);
      if (!failures.length) {
        state.challenges=settleChallenges(daily,state.challenges,{today,backfill:!state.challenges.initialized});
        state.initialized=true;
      }
      const result={...ledgerView(state,daily,today),archivedSessions:Object.keys(state.sessions).filter(id=>!active.has(id)).length,sessionCount:active.size-excluded.length,excludedSessions:excluded.length,updatedAt:this.clock(),complete:failures.length===0,failedSessions:failures.length};
      return result;
    });
    this.revisions=nextRevisions;this.latest=result;
    return result;
  }
  async acknowledge(ids) {
    if (!Array.isArray(ids) || ids.length>1000 || ids.some(id=>typeof id!=='string' || id.length>100)) throw new Error('Invalid award ids');
    return this.mutate(state=>{
      const known=new Set(state.awards.map(a=>a.id));
      if(ids.some(id=>!known.has(id))) throw new Error('Unknown award id');
      for(const award of state.awards) if(ids.includes(award.id)) award.seen=true;
    });
  }
  async mutate(change){
    return this.enqueue(async()=>{
      const committed=await this.ledger.update(state=>{
        change(state);
        return ledgerView(state,aggregateDaily(state),localDate(this.clock(),state.timeZone));
      });
      try{return await this.scan();}
      catch{
        // The write is durable; retain stored usage and the last successful scan's timestamp.
        const previous=this.latest;
        return this.latest={...committed,archivedSessions:previous?.archivedSessions??null,sessionCount:previous?.sessionCount??null,excludedSessions:previous?.excludedSessions??null,updatedAt:previous?.updatedAt??null,complete:false,failedSessions:null,error:'修改已保存，但同步失败；当前用量可能不是最新，请稍后重试。'};
      }
    });
  }
  acknowledgeChallenges(ids){
    if(!Array.isArray(ids)||ids.length>1000||ids.some(id=>typeof id!=='string'||id.length>100))return Promise.reject(new Error('Invalid challenge ids'));
    return this.mutate(state=>{
      const known=new Set(state.challenges?.awards.map(a=>a.id));
      if(ids.some(id=>!known.has(id)))throw new Error('Unknown challenge id');
      state.challenges.awards.forEach(a=>{if(ids.includes(a.id))a.seen=true;});
    });
  }
}
