import type {Market} from './types';

export type ContextQualityGrade='COMPLETE'|'GOOD'|'PARTIAL'|'THIN'|'NONE';

export type ContextDimensionAudit={
 key:string;
 weight:number;
 critical:boolean;
 present:boolean;
 source?:string;
};

export type ContextQuality={
 score:number;
 coverage:number;
 criticalCoverage:number;
 sourceQuality:number;
 sourceCount:number;
 grade:ContextQualityGrade;
 recommendationReady:boolean;
 missingCritical:string[];
 missingOptional:string[];
 dimensions:ContextDimensionAudit[];
 updatedAt:string;
};

type Requirement={key:string;weight:number;critical?:boolean};

const BASE:Requirement[]=[
 {key:'injury',weight:1.1,critical:true},
 {key:'form',weight:.7},
 {key:'rest',weight:.6}
];

const PROFILES:Array<{match:(sport:string)=>boolean;requirements:Requirement[]}>= [
 {
  match:s=>/(NFL|NCAAF|COLLEGE FOOTBALL|AMERICAN FOOTBALL)/.test(s),
  requirements:[
   {key:'quarterback',weight:1.5,critical:true},
   {key:'injury',weight:1.2,critical:true},
   {key:'trenches',weight:.9},
   {key:'efficiency',weight:.9},
   {key:'rest',weight:.7},
   {key:'travel',weight:.5},
   {key:'weather',weight:.5}
  ]
 },
 {
  match:s=>/(MLB|NPB|BASEBALL)/.test(s),
  requirements:[
   {key:'starter',weight:1.5,critical:true},
   {key:'lineup',weight:1.2,critical:true},
   {key:'bullpen',weight:1},
   {key:'park',weight:.8},
   {key:'weather',weight:.7},
   {key:'offenseHandedness',weight:.6},
   {key:'rest',weight:.5}
  ]
 },
 {
  match:s=>/(NBA|WNBA|NCAAB|COLLEGE BASKETBALL|BASKETBALL)/.test(s),
  requirements:[
   {key:'injury',weight:1.3,critical:true},
   {key:'lineup',weight:1.3,critical:true},
   {key:'pace',weight:1},
   {key:'efficiency',weight:1},
   {key:'shooting',weight:.7},
   {key:'rest',weight:.7},
   {key:'travel',weight:.5}
  ]
 },
 {
  match:s=>/(NHL|HOCKEY)/.test(s),
  requirements:[
   {key:'goalie',weight:1.5,critical:true},
   {key:'injury',weight:1.2,critical:true},
   {key:'lineup',weight:1,critical:true},
   {key:'specialTeams',weight:.9},
   {key:'shotQuality',weight:.8},
   {key:'rest',weight:.6},
   {key:'travel',weight:.5}
  ]
 },
 {
  match:s=>/(SOCCER|EPL|MLS|LIGA|SERIE|BUNDESLIGA|CHAMPIONS|LEAGUE)/.test(s),
  requirements:[
   {key:'lineup',weight:1.2,critical:true},
   {key:'injury',weight:1.1,critical:true},
   {key:'keeper',weight:1,critical:true},
   {key:'xg',weight:1},
   {key:'form',weight:.8},
   {key:'tactical',weight:.7},
   {key:'weather',weight:.4}
  ]
 },
 {
  match:s=>/(TENNIS|ATP|WTA)/.test(s)&&!/TABLE/.test(s),
  requirements:[
   {key:'surface',weight:1.2,critical:true},
   {key:'serve',weight:1.2,critical:true},
   {key:'return',weight:1.2,critical:true},
   {key:'form',weight:.8},
   {key:'fatigue',weight:.8},
   {key:'headToHead',weight:.5}
  ]
 },
 {
  match:s=>/(TABLE TENNIS)/.test(s),
  requirements:[
   {key:'serve',weight:1.2,critical:true},
   {key:'return',weight:1.2,critical:true},
   {key:'form',weight:.9},
   {key:'fatigue',weight:.7},
   {key:'headToHead',weight:.5}
  ]
 },
 {
  match:s=>/(UFC|MMA|MIXED MARTIAL)/.test(s),
  requirements:[
   {key:'striking',weight:1.2,critical:true},
   {key:'grappling',weight:1.2,critical:true},
   {key:'cardio',weight:.9},
   {key:'takedownDefense',weight:.8},
   {key:'weightCut',weight:.8},
   {key:'reach',weight:.5},
   {key:'recentForm',weight:.6}
  ]
 }
];

const clamp=(n:number,min=0,max=1)=>Math.max(min,Math.min(max,n));

function sportName(m:Market){
 return String(m.sport||m.league||'').toUpperCase();
}

function isPlayerMarket(m:Market){
 const t=`${m.market} ${m.selection}`.toLowerCase();
 return /player|points|rebounds|assists|yards|receptions|touchdowns|strikeouts|hits|home runs|shots|saves|goals|games won|aces/.test(t)&&Boolean(m.playerContext);
}

function playerDimension(m:Market,key:string){
 const p=m.playerContext;
 if(!p)return false;
 if(key==='playerProjection')return Number.isFinite(Number(p.projection))&&Number.isFinite(Number(p.stdDev));
 if(key==='playerAvailability')return Number.isFinite(Number(p.availability))||Boolean(p.status);
 if(key==='starter')return p.starter!==undefined;
 if(key==='injury')return Boolean(p.status)||Number.isFinite(Number(p.availability));
 return false;
}

function present(m:Market,key:string){
 if(Object.prototype.hasOwnProperty.call(m.sportFeatures||{},key)){
  return Number.isFinite(Number(m.sportFeatures?.[key]));
 }
 return playerDimension(m,key);
}

export function contextRequirements(m:Market):Requirement[]{
 const s=sportName(m);
 const profile=PROFILES.find(x=>x.match(s));
 const requirements=[...(profile?.requirements||BASE)];
 if(isPlayerMarket(m)){
  requirements.push(
   {key:'playerProjection',weight:1.5,critical:true},
   {key:'playerAvailability',weight:1.1,critical:true}
  );
 }
 const byKey=new Map<string,Requirement>();
 for(const r of requirements){
  const previous=byKey.get(r.key);
  if(!previous||r.weight>previous.weight||Boolean(r.critical&&!previous.critical))byKey.set(r.key,r);
 }
 return [...byKey.values()];
}

export function assessContextQuality(
 m:Market,
 sourceQuality:Record<string,number>={}
):ContextQuality{
 const requirements=contextRequirements(m);
 const sources=m.contextSources||[];
 const totalWeight=requirements.reduce((s,x)=>s+x.weight,0)||1;
 const critical=requirements.filter(x=>x.critical);
 const criticalWeight=critical.reduce((s,x)=>s+x.weight,0)||1;
 let presentWeight=0;
 let presentCritical=0;

 const dimensions=requirements.map(r=>{
  const isPresent=present(m,r.key);
  if(isPresent){
   presentWeight+=r.weight;
   if(r.critical)presentCritical+=r.weight;
  }
  return {
   key:r.key,
   weight:r.weight,
   critical:Boolean(r.critical),
   present:isPresent,
   source:sources.length?sources.join(','):undefined
  };
 });

 const coverage=clamp(presentWeight/totalWeight);
 const criticalCoverage=critical.length?clamp(presentCritical/criticalWeight):coverage;
 const qualities=sources.map(x=>Number(sourceQuality[x])).filter(Number.isFinite).map(x=>clamp(x));
 const sourceScore=qualities.length?qualities.reduce((s,x)=>s+x,0)/qualities.length:(sources.length?.65:0);
 const score=clamp(coverage*.55+criticalCoverage*.30+sourceScore*.15);
 const grade:ContextQualityGrade=score>=.88?'COMPLETE':score>=.72?'GOOD':score>=.50?'PARTIAL':score>0?'THIN':'NONE';
 const missingCritical=dimensions.filter(x=>x.critical&&!x.present).map(x=>x.key);
 const missingOptional=dimensions.filter(x=>!x.critical&&!x.present).map(x=>x.key);
 const recommendationReady=score>=.60&&coverage>=.55&&criticalCoverage>=.66&&sources.length>0;

 return {
  score,
  coverage,
  criticalCoverage,
  sourceQuality:sourceScore,
  sourceCount:sources.length,
  grade,
  recommendationReady,
  missingCritical,
  missingOptional,
  dimensions,
  updatedAt:new Date().toISOString()
 };
}

export function summarizeContextQuality(markets:Market[]){
 const qualities=markets.map(m=>m.contextQuality).filter((x):x is ContextQuality=>Boolean(x));
 const avg=(key:'score'|'coverage'|'criticalCoverage')=>qualities.length
  ?qualities.reduce((s,x)=>s+x[key],0)/qualities.length
  :0;
 return {
  totalRows:markets.length,
  scoredRows:qualities.length,
  recommendationReadyRows:qualities.filter(x=>x.recommendationReady).length,
  completeRows:qualities.filter(x=>x.grade==='COMPLETE').length,
  goodRows:qualities.filter(x=>x.grade==='GOOD').length,
  partialRows:qualities.filter(x=>x.grade==='PARTIAL').length,
  thinRows:qualities.filter(x=>x.grade==='THIN').length,
  noneRows:qualities.filter(x=>x.grade==='NONE').length,
  averageScore:avg('score'),
  averageCoverage:avg('coverage'),
  averageCriticalCoverage:avg('criticalCoverage'),
  missingCritical:[...new Set(qualities.flatMap(x=>x.missingCritical))].sort()
 };
}
