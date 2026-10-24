import {mkdir,open,readFile,rename,unlink} from 'node:fs/promises';
import {dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {RULES} from './awards.js';
import {CHALLENGES} from './challenges.js';
import {period} from './calendar.js';

const isRecord=value=>value!==null && typeof value==='object' && !Array.isArray(value);
const isCount=value=>Number.isSafeInteger(value) && value>=0;
const isDate=value=>typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0,10)===value;

function validAward(award) {
  if (!isRecord(award)) return false;
  const rule=RULES.find(rule=>rule.id===award.ruleId);
  if (!rule || award.id!==`${rule.id}:${award.period}` || !isDate(award.earnedOn) || !isCount(award.tokens) || typeof award.serial!=='string' || !/^\d{6,}$/.test(award.serial) || !isCount(Number(award.serial)) || Number(award.serial)===0 || typeof award.seen!=='boolean' || typeof award.backfilled!=='boolean') return false;
  if (rule.family==='lifetime') return award.period==='lifetime' && award.end===null;
  if (!isDate(award.period)) return false;
  const expected=period(award.period,rule.unit);
  if (award.period!==expected.start || award.end!==expected.end) return false;
  return rule.family==='growth'
    ? isCount(award.previous) && award.earnedOn===award.end
    : award.earnedOn>=award.period && award.earnedOn<award.end;
}

function validateChallenges(s){
  const invalid=()=>{throw new Error('Invalid challenge ledger; restore from backup before continuing');};
  if(!isRecord(s)||s.version!==2||typeof s.initialized!=='boolean'||!isDate(s.enabledOn)||!Array.isArray(s.awards)||!Array.isArray(s.completedDays))invalid();
  if(s.knownRules!==undefined&&(!Array.isArray(s.knownRules)||s.knownRules.some(id=>typeof id!=='string')))invalid();
  if(s.completedDays.some(d=>!isDate(d)||d<s.enabledOn)||new Set(s.completedDays).size!==s.completedDays.length)invalid();
  const ids=new Set(),serials=new Set();
  for(const a of s.awards){
    if(!isRecord(a))invalid();const rule=CHALLENGES.find(r=>r.id===a.ruleId);
    if(!rule||a.id!==`${rule.id}:${a.period}`||ids.has(a.id)||!isDate(a.earnedOn)||!isCount(a.tokens)||!isCount(a.value)||typeof a.serial!=='string'||!/^\d{6,}$/.test(a.serial)||!isCount(Number(a.serial))||!Number(a.serial)||serials.has(a.serial)||typeof a.seen!=='boolean'||typeof a.backfilled!=='boolean')invalid();
    ids.add(a.id);serials.add(a.serial);
    if(rule.unit==='lifetime'){if(a.period!=='lifetime'||a.end!==null)invalid();}
    else if(rule.unit==='day'){if(!isDate(a.period)||a.end!==null||a.earnedOn!==a.period||a.period<s.enabledOn)invalid();}
    else {if(!isDate(a.period))invalid();const p=period(a.period,rule.unit);if(a.period!==p.start||a.end!==p.end||(rule.perfect||rule.metric==='growth'?a.earnedOn!==a.end:a.earnedOn<a.period||a.earnedOn>=a.end))invalid();}
    if(rule.metric==='growth'&&(!isCount(a.previous)||a.previous<rule.minimum))invalid();
  }
}

function validate(s) {
  if (!isRecord(s) || s.version !== 1 || typeof s.timeZone !== 'string' || typeof s.initialized !== 'boolean' || !Array.isArray(s.awards) || !isRecord(s.sessions)) throw new Error('Invalid medals ledger; restore from backup before continuing');
  try {new Intl.DateTimeFormat('en',{timeZone:s.timeZone});}
  catch {throw new Error('Invalid medals ledger time zone');}
  if (s.awards.some(a=>!validAward(a)) || new Set(s.awards.map(a=>a.id)).size !== s.awards.length) throw new Error('Invalid medals ledger awards');
  for (const [id,session] of Object.entries(s.sessions)) {
    if (!id || ['__proto__','constructor','prototype'].includes(id) || !isRecord(session) || !isRecord(session.daily) || Object.entries(session.daily).some(([d,n])=>!isDate(d) || !isCount(n))) throw new Error('Invalid medals ledger usage');
  }
  if(s.challenges!==undefined)validateChallenges(s.challenges);
  return s;
}

/** An exclusive lock fails closed after a crash, protecting permanent awards from competing writers. */
export class Ledger {
  constructor(path,timeZone) { this.path=path; this.timeZone=timeZone; }
  async update(change) {
    await mkdir(dirname(this.path),{recursive:true,mode:0o700});
    const lockPath=`${this.path}.lock`;
    let lock;
    for (let i=0;i<100;i++) {
      try { lock=await open(lockPath,'wx',0o600); break; }
      catch(e) { if(e.code!=='EEXIST') throw e; await delay(50); }
    }
    if (!lock) throw new Error('Medals ledger locked; another writer is active or a stale .lock needs recovery');
    const tmp=`${this.path}.${randomUUID()}.tmp`;
    try {
      await lock.writeFile(String(process.pid));
      let state;
      try {state=validate(JSON.parse(await readFile(this.path,'utf8')));}
      catch(e) {
        if(e.code!=='ENOENT') throw e;
        state={version:1,timeZone:this.timeZone,initialized:false,sessions:{},awards:[]};
      }
      const result=await change(state);
      validate(state);
      const file=await open(tmp,'wx',0o600);
      try {await file.writeFile(JSON.stringify(state));await file.sync();} finally {await file.close();}
      await rename(tmp,this.path);
      const dir=await open(dirname(this.path),'r');
      try {await dir.sync();} finally {await dir.close();}
      return result;
    } finally {
      await unlink(tmp).catch(e=>{if(e.code!=='ENOENT') throw e;});
      await lock.close();
      await unlink(lockPath);
    }
  }
}
