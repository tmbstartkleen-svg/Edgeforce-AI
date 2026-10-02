import type {Market} from '../types';
import {fetchWeatherContext,fetchInjuryContext,fetchStatsContext} from './context';

type ContextKind='weather'|'injuries'|'stats';
type ContextRow={
 eventId?:string;
 event?:string;
 home?:string;
 away?:string;
 sport?:string;
 features:Record<string,number>;
};

const obj=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const arr=(payload:unknown):unknown[]=>{
 if(Array.isArray(payload))return payload;
 const root=obj(payload);
 for(const k of ['data','results','events','rows','items']){
  if(Array.isArray(root[k]))return root[k] as unknown[];
 }
 return [];
};
const str=(v:unknown)=>typeof v==='string'?v:'';
const num=(v:unknown)=>{
 const n=typeof v==='number'?v:Number(v);
 return Number.isFinite(n)?Math.max(-1,Math.min(1,n)):0;
};
const FEATURE_KEYS=[
 'home','injury','quarterback','offenseDefense','rest','weather','trenches','turnover',
 'starter','bullpen','offenseHandedness','park','defense','lineup','usage','pace','matchup',
 'shooting','travel','tempo','efficiency','rebounding','experience','goalie','shotQuality',
 'specialTeams','xg','keeper','form','tactical','setPieces','surface','serve','return',
 'fatigue','headToHead','striking','grappling','takedownDefense','cardio','reach','ageCurve',
 'finishRisk','weightCut','courseFit','approach','offTee','putting','recentForm','fieldStrength',
 'style','trackFit','qualifying','teamPace','reliability','grid','batting','bowling','venue',
 'toss','pack','kicking','discipline','receive','attack','block','faceoff','mapPool','roster','patch'
];

function normalizeRows(payload:unknown,kind:ContextKind):ContextRow[]{
 return arr(payload).map(v=>{
  const r=obj(v);
  const nested=obj(r.features);
  const features:Record<string,number>={};
  for(const key of FEATURE_KEYS){
   if(key in nested)features[key]=num(nested[key]);
   else if(key in r)features[key]=num(r[key]);
  }
  if(kind==='injuries'&&!('injury' in features)){
   const impact=num(r.impact||r.injuryImpact||r.injury_impact);
   if(impact)features.injury=impact;
  }
  if(kind==='weather'&&!('weather' in features)){
   const impact=num(r.impact||r.weatherImpact||r.weather_impact);
   if(impact)features.weather=impact;
  }
  return {
   eventId:str(r.eventId||r.event_id||r.id),
   event:str(r.event||r.eventName||r.event_name),
   home:str(r.home||r.homeTeam||r.home_team),
   away:str(r.away||r.awayTeam||r.away_team),
   sport:str(r.sport||r.league),
   features
  };
 }).filter(x=>Object.keys(x.features).length>0);
}

function match(m:Market,r:ContextRow){
 if(r.eventId&&r.eventId===m.id)return true;
 if(r.event&&r.event.toLowerCase()===m.event.toLowerCase())return true;
 if(r.home&&r.away&&r.home.toLowerCase()===m.home.toLowerCase()&&r.away.toLowerCase()===m.away.toLowerCase())return true;
 return false;
}

export async function enrichMarketsWithContext(markets:Market[]){
 const [weather,injuries,stats]=await Promise.all([
  fetchWeatherContext(),
  fetchInjuryContext(),
  fetchStatsContext()
 ]);
 const sources=[
  {kind:'weather' as const,result:weather},
  {kind:'injuries' as const,result:injuries},
  {kind:'stats' as const,result:stats}
 ];
 const normalized=sources.map(s=>({
  kind:s.kind,
  ok:s.result.ok,
  providerId:s.result.providerId,
  attempts:s.result.attempts,
  rows:s.result.ok?normalizeRows(s.result.data,s.kind):[]
 }));
 let matchedRows=0;
 const enriched=markets.map(m=>{
  const sportFeatures={...(m.sportFeatures||{})};
  const matchedKinds:string[]=[];
  for(const source of normalized){
   let matched=false;
   for(const row of source.rows){
    if(!match(m,row))continue;
    Object.assign(sportFeatures,row.features);
    matched=true;
   }
   if(matched)matchedKinds.push(source.kind);
  }
  if(matchedKinds.length)matchedRows++;
  return {...m,sportFeatures,contextSources:matchedKinds};
 });
 return {
  markets:enriched,
  diagnostics:{
   matchedRows,
   totalRows:markets.length,
   providers:normalized.map(x=>({kind:x.kind,ok:x.ok,providerId:x.providerId,rowCount:x.rows.length,attempts:x.attempts}))
  }
 };
}
