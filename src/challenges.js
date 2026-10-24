import {period} from './calendar.js';
import {safeAdd} from './usage.js';
import {RULES} from './awards.js';

// Lifetime 1B/5B/10B milestones: one star, a star chart, a river of stars (docs/adr/0001-cosmic-milestones.md).
const COSMIC=[
  {id:'starfire',name:'星火初燃',metal:'gold',inscription:'一点星火，终将燎原'},
  {id:'starchart',name:'群星为图',metal:'gold',inscription:'把散落的星，连成自己的图'},
  {id:'starriver',name:'星河万里',metal:'gold',inscription:'星河万里，皆是来路'},
  // Monthly usage: realistic celestial bodies, each with the previous tier as a companion (docs/adr/0004-monthly-usage-series.md).
  {id:'moon',name:'月面漫游',metal:'silver',inscription:'每一小步，都留下一点光'},
  {id:'earth',name:'蔚蓝家园',metal:'gold',inscription:'一整个月的探索，绕成一颗蓝色星球'},
  {id:'sun',name:'日冕之光',metal:'gold',inscription:'把一个月的光，聚成一颗太阳'},
  {id:'blackhole',name:'事件视界',metal:'gold',inscription:'连光都无法逃离的一个月'},
];
function crafted(design){
  const {name,metal,inscription}=[...RULES,...COSMIC].find(rule=>rule.id===design)??{name:design,metal:'gold',inscription:'让每一份探索，都有自己的形状'};
  return {name,metal,inscription,design};
}

export const DAILY_TARGET=5e6;

export const CHALLENGES=[1,2,4].map(multiplier=>({id:`daily-${multiplier}`,name:`单日 ${multiplier*5}M`,series:'daily',family:'period',unit:'day',metric:'tokens',target:DAILY_TARGET*multiplier,number:String(multiplier*5),suffix:'M',grade:0,metal:'silver',design:'numeric'})).concat([3,5,7].map(target=>({id:`week-days-${target}`,name:target===7?'完美一周':`一周 ${target} 天`,series:'weekly',family:'period',unit:'week',metric:'days',target,number:String(target),grade:target===7?1:0,metal:'silver',design:'numeric',perfect:target===7})),[7,30,100,365].map(target=>({id:`days-${target}`,name:`${target} 个达标日`,series:'days',family:'lifetime',unit:'lifetime',metric:'days',target,number:String(target),grade:target>=100?2:target>=30?1:0,metal:target>=365?'silver':'gold',design:target>=365?'compass':target>=100?'evergreen':'numeric'})));
CHALLENGES.push(
  ...[10,20,'all'].map(target=>({id:`month-days-${target}`,name:target==='all'?'完美一月':`一月 ${target} 天`,series:'monthly',family:'period',unit:'month',metric:'days',target,number:target==='all'?'M':String(target),grade:target==='all'?2:1,metal:'gold',design:target==='all'?'rosette':'numeric',perfect:target==='all'})),
  ...[['100M',100e6,'first'],['500M',500e6,'beyond'],['1B',1e9,'starfire'],['5B',5e9,'starchart'],['10B',10e9,'starriver']].map(([number,target,design],index)=>{
    const artwork=crafted(design);
    return {...artwork,id:`tokens-${number}`,name:artwork.name,series:'tokens',family:'lifetime',unit:'lifetime',metric:'tokens',target,number,grade:index===0?1:2};
  }),
  {...crafted('orbit'),id:'volume-week',series:'volume',family:'period',unit:'week',metric:'tokens',target:50e6,number:'50M',grade:1},
  {...crafted('moon'),id:'volume-month',series:'monthlyVolume',family:'period',unit:'month',metric:'tokens',target:200e6,number:'200M',grade:1},
  {...crafted('earth'),id:'volume-month-500M',series:'monthlyVolume',family:'period',unit:'month',metric:'tokens',target:500e6,number:'500M',grade:1},
  {...crafted('sun'),id:'volume-month-1B',series:'monthlyVolume',family:'period',unit:'month',metric:'tokens',target:1e9,number:'1B',grade:2},
  {...crafted('blackhole'),id:'volume-month-3B',series:'monthlyVolume',family:'period',unit:'month',metric:'tokens',target:3e9,number:'3B',grade:2},
  {...crafted('rise'),id:'growth-week',series:'growth',family:'growth',unit:'week',metric:'growth',growth:1,minimum:5e6,number:'100',suffix:'%',grade:1},
  {...crafted('dawn'),id:'growth-month',series:'growth',family:'growth',unit:'month',metric:'growth',growth:2,minimum:20e6,number:'200',suffix:'%',grade:2}
);
export function createChallenges(today){return{version:2,initialized:false,completedDays:[],enabledOn:today,awards:[]};}
// Rules that existed before ledgers started recording knownRules.
const ORIGINAL_RULES=new Set(['daily-1','daily-2','daily-4','week-days-3','week-days-5','week-days-7','days-7','days-30','days-100','days-365','month-days-10','month-days-20','month-days-all','tokens-100M','tokens-500M','tokens-1B','tokens-5B','tokens-10B','volume-week','volume-month','growth-week','growth-month']);
export function settleChallenges(daily,state,{today,backfill=false}){
  const dates=Object.keys(daily).filter(d=>d<=today).sort();
  // A rule added after install backfills its already-closed periods quietly instead of revealing each one.
  const known=new Set(state.knownRules??(state.initialized?ORIGINAL_RULES:[]));
  const quiet=(rule,end)=>backfill||(!known.has(rule.id)&&end!==null&&end<=today);
  const completedDays=dates.filter(d=>d>=state.enabledOn&&daily[d]>=DAILY_TARGET);
  const awards=[...state.awards],ids=new Set(awards.map(a=>a.id));
  for(const rule of CHALLENGES){
    if(rule.metric==='growth'){
      const totals=new Map();for(const date of dates){const key=period(date,rule.unit).start;totals.set(key,safeAdd(totals.get(key)??0,daily[date]));}
      for(const [start,n] of totals){const p=period(start,rule.unit),previous=totals.get(p.previous)??0,id=`${rule.id}:${start}`;
        if(p.end>today||previous<rule.minimum||BigInt(n)<BigInt(previous)*BigInt(1+rule.growth)||ids.has(id))continue;
        ids.add(id);const q=quiet(rule,p.end);awards.push({id,ruleId:rule.id,period:start,end:p.end,earnedOn:p.end,tokens:n,value:n,previous,serial:String(awards.length+1).padStart(6,'0'),seen:q,backfilled:q});
      }
      continue;
    }
    const source=rule.metric==='days'?completedDays:dates;
    const totals=new Map();
    for(const date of source){
      if(rule.unit==='day'&&date<state.enabledOn)continue;
      const p=rule.unit==='day'?{start:date,end:null}:rule.unit==='lifetime'?{start:'lifetime',end:null}:period(date,rule.unit);
      const value=rule.metric==='days'?1:daily[date];
      const n=safeAdd(totals.get(p.start)??0,value);totals.set(p.start,n);
      const threshold=rule.target==='all'?(Date.parse(p.end)-Date.parse(p.start))/864e5:rule.target;
      const id=`${rule.id}:${p.start}`;
      if(ids.has(id)||n<threshold)continue;
      if(rule.perfect&&(p.start<state.enabledOn||p.end>today))continue;
      ids.add(id);const q=quiet(rule,p.end);
      awards.push({id,ruleId:rule.id,period:p.start,end:p.end,earnedOn:rule.perfect?p.end:date,tokens:daily[date],value:n,serial:String(awards.length+1).padStart(6,'0'),seen:q,backfilled:q});
    }
  }
  return{version:2,initialized:true,enabledOn:state.enabledOn,awards,completedDays,knownRules:CHALLENGES.map(rule=>rule.id)};
}

export function challengeProgress(daily,state,today){
  const dates=Object.keys(daily).filter(d=>d<=today),days=state.completedDays??[];
  const sum=(start,end)=>dates.filter(d=>d>=start&&(!end||d<end)).map(d=>daily[d]).reduce(safeAdd,0);
  return Object.fromEntries(CHALLENGES.map(rule=>{
    const p=rule.unit==='day'?{start:today,end:null}:rule.unit==='lifetime'?{start:'lifetime',end:null}:period(today,rule.unit);
    let current=rule.metric==='days'?(rule.unit==='lifetime'?days.length:days.filter(d=>d>=p.start&&d<p.end).length):rule.unit==='day'?(daily[today]??0):rule.unit==='lifetime'?sum('0000-01-01',null):sum(p.start,p.end);
    let target=rule.target==='all'?(Date.parse(p.end)-Date.parse(p.start))/864e5:rule.target;
    let previous=null,eligible=true;
    if(rule.metric==='growth'){previous=sum(p.previous,p.start);eligible=previous>=rule.minimum;target=eligible?previous*(1+rule.growth):null;}
    const earned=state.awards.some(a=>a.id===`${rule.id}:${p.start}`);
    return[rule.id,{current,target,previous,eligible,earned,period:p.start,end:p.end,settlesOn:rule.perfect||rule.metric==='growth'?p.end:null,percent:target?Math.min(100,current/target*100):null}];
  }));
}
