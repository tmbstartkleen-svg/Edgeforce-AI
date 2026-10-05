import type {Market,ContextProvenance} from '../types';
import {fetchWeatherContext,fetchStatsContext} from './context';
import {fetchTrackedInjuryContext} from '../liveInjuryTracking';
import {assessContextQuality,summarizeContextQuality} from '../contextQuality';
import {fetchPublicSportsContext,type PublicContextRow} from './publicSportsContext';
import {enrichMarketsWithPlayerWarehouse} from '../playerWarehouse';
import {enrichMarketsWithPlayerFeatureFrames} from '../playerFeatureFrames';
import {enrichMarketsWithPlayerCalibration} from '../playerCalibration';
import {enrichMarketsWithOpponentMatchups} from '../opponentMatchupLearning';
import {enrichMarketsWithLineupRedistribution} from '../lineupRoleRedistribution';
import {enrichMarketsWithStartingLineups} from '../startingLineupIntelligence';
import {enrichMarketsWithExternalExpertModels} from '../expertModelBridge';
import {enrichMarketsWithPremiumData} from '../expertDataBridge';
import {enrichMarketsWithTrainedSportModels} from '../trainedSportModels';

type ContextKind='weather'|'injuries'|'stats';
type ContextRow={
 eventId?:string;
 event?:string;
 home?:string;
 away?:string;
 sport?:string;
 features:Record<string,number>;
 player?:{
  name:string;
  team?:string;
  status?:string;
  starter?:boolean;
  availability?:number;
  projection?:number;
  stdDev?:number;
  minutes?:number;
  usage?:number;
  statKey?:string;
 };
 provenance?:ContextProvenance[];
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
const rawNum=(v:unknown)=>{
 const n=typeof v==='number'?v:Number(v);
 return Number.isFinite(n)?n:undefined;
};
const bool=(v:unknown)=>{
 if(typeof v==='boolean')return v;
 if(typeof v==='number')return v!==0;
 if(typeof v==='string')return ['true','yes','1','starter','starting','active'].includes(v.toLowerCase());
 return undefined;
};
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

function normalizeRows(payload:unknown,kind:ContextKind,providerId?:string):ContextRow[]{
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
  const playerName=str(r.playerName||r.player_name||r.athleteName||r.athlete_name||r.player||r.athlete);
  const projection=rawNum(r.projection??r.projectionMean??r.projection_mean??r.propMean??r.prop_mean);
  const stdDev=rawNum(r.stdDev??r.std_dev??r.projectionStd??r.projection_std??r.propStd??r.prop_std);
  const minutes=rawNum(r.minutes??r.projectedMinutes??r.projected_minutes);
  const usage=rawNum(r.usage??r.usageRate??r.usage_rate);
  const availabilityRaw=rawNum(r.availability??r.availabilityProbability??r.availability_probability);
  const status=str(r.status||r.injuryStatus||r.injury_status);
  const statusAvailability=(()=>{
   const s=status.toLowerCase();
   if(!s)return undefined;
   if(/out|inactive|ir|injured reserve|suspended/.test(s))return 0;
   if(/doubtful/.test(s))return .25;
   if(/questionable|game[- ]?time/.test(s))return .55;
   if(/probable/.test(s))return .85;
   if(/active|available|healthy/.test(s))return 1;
   return undefined;
  })();
  const player=playerName?{
   name:playerName,
   team:str(r.team||r.teamName||r.team_name)||undefined,
   status:status||undefined,
   starter:bool(r.starter??r.isStarter??r.is_starter??r.starting),
   availability:(availabilityRaw??statusAvailability)===undefined?undefined:Math.max(0,Math.min(1,Number(availabilityRaw??statusAvailability))),
   projection,
   stdDev,
   minutes,
   usage,
   statKey:str(r.statKey||r.stat_key||r.marketKey||r.market_key)||undefined
  }:undefined;
  const fields=[...Object.keys(features),...(player?['playerAvailability']:[])];
  const observedAt=new Date().toISOString();
  return {
   eventId:str(r.eventId||r.event_id||r.id),
   event:str(r.event||r.eventName||r.event_name),
   home:str(r.home||r.homeTeam||r.home_team),
   away:str(r.away||r.awayTeam||r.away_team),
   sport:str(r.sport||r.league),
   features,
   player,
   provenance:fields.map(field=>({
    source:kind,
    providerId:providerId||kind,
    field,
    observedAt,
    confidence:.80,
    status:'LIVE' as const
   }))
  };
 }).filter(x=>Object.keys(x.features).length>0||Boolean(x.player));
}

function match(m:Market,r:ContextRow){
 if(r.eventId&&r.eventId===m.id)return true;
 if(r.event&&r.event.toLowerCase()===m.event.toLowerCase())return true;
 if(r.home&&r.away&&r.home.toLowerCase()===m.home.toLowerCase()&&r.away.toLowerCase()===m.away.toLowerCase())return true;
 return false;
}

function sourceNames(row:PublicContextRow){
 return [...new Set([row.source,...row.provenance.map(x=>x.source)].filter(Boolean))];
}

export async function enrichMarketsWithContext(markets:Market[]){
 const [weather,injuries,stats,publicNetwork]=await Promise.all([
  fetchWeatherContext(),
  fetchTrackedInjuryContext(),
  fetchStatsContext(),
  fetchPublicSportsContext(markets)
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
  qualityScore:s.result.quality?.qualityScore??(s.result.ok ? .7 : 0),
  rows:s.result.ok?normalizeRows(s.result.data,s.kind,s.result.providerId):[]
 }));
 const sourceQuality={
  ...publicNetwork.sourceQuality,
  ...Object.fromEntries(normalized.map(x=>[x.kind,x.qualityScore]))
 };

 let matchedRows=0;
 const enriched=markets.map(m=>{
  const sportFeatures={...(m.sportFeatures||{})};
  const matchedKinds:string[]=[];
  const provenance:ContextProvenance[]=[...(m.contextProvenance||[])];
  let playerContext=m.playerContext;

  // Public sources fill gaps first. Configured providers below are authoritative overrides.
  for(const row of publicNetwork.rows){
   if(!match(m,row))continue;
   if(row.player){
    const name=row.player.name.toLowerCase();
    const selection=m.selection.toLowerCase();
    if(!selection.includes(name))continue;
    playerContext={...playerContext,...row.player,name:row.player.name};
   }
   Object.assign(sportFeatures,row.features);
   matchedKinds.push(...sourceNames(row));
   provenance.push(...row.provenance);
  }

  for(const source of normalized){
   let matched=false;
   for(const row of source.rows){
    if(!match(m,row))continue;
    if(row.player){
     const name=row.player.name.toLowerCase();
     const selection=m.selection.toLowerCase();
     if(!selection.includes(name))continue;
     playerContext={...playerContext,...row.player,name:row.player.name};
    }
    Object.assign(sportFeatures,row.features);
    provenance.push(...(row.provenance||[]));
    matched=true;
   }
   if(matched)matchedKinds.push(source.kind);
  }

  const contextSources=[...new Set(matchedKinds)];
  if(contextSources.length)matchedRows++;
  const enrichedMarket={...m,sportFeatures,contextSources,contextProvenance:provenance,playerContext};
  return {...enrichedMarket,contextQuality:assessContextQuality(enrichedMarket,sourceQuality)};
 });
 const premium=await enrichMarketsWithPremiumData(enriched);
 const historical=await enrichMarketsWithPlayerWarehouse(premium.markets).catch(()=>({markets:premium.markets,matched:0,players:0}));
 const playerFrames=await enrichMarketsWithPlayerFeatureFrames(historical.markets).catch(()=>({markets:historical.markets,matched:0,players:0,frames:[]}));
 const playerCalibration=await enrichMarketsWithPlayerCalibration(playerFrames.markets).catch(()=>({markets:playerFrames.markets,matched:0,profiles:0}));
 const opponentMatchups=await enrichMarketsWithOpponentMatchups(playerCalibration.markets).catch(()=>({markets:playerCalibration.markets,matched:0,profiles:0,playerProfiles:0}));
 const lineupRedistribution=await enrichMarketsWithLineupRedistribution(opponentMatchups.markets).catch(()=>({markets:opponentMatchups.markets,matched:0,profiles:0,activeAbsences:0}));
 const startingLineups=await enrichMarketsWithStartingLineups(lineupRedistribution.markets).catch(()=>({markets:lineupRedistribution.markets,matched:0,profiles:0,promotions:0}));
 const trainedSportMl=await enrichMarketsWithTrainedSportModels(startingLineups.markets);
 const externalExpert=await enrichMarketsWithExternalExpertModels(trainedSportMl.markets);
 const finalSourceQuality={
  ...sourceQuality,...premium.sourceQuality,
  'player-history-db':historical.matched?.92:0,
  'player-feature-frame':playerFrames.matched?.95:0,
  'player-calibration':playerCalibration.matched?.96:0,
  'opponent-matchup':opponentMatchups.matched?.94:0,
  'lineup-redistribution':lineupRedistribution.matched?.95:0,
  'starting-lineup':startingLineups.matched?.96:0
 };
 const finalMarkets=externalExpert.markets.map(row=>({...row,contextQuality:assessContextQuality(row,finalSourceQuality)}));
 const qualitySummary=summarizeContextQuality(finalMarkets);
 return {
  markets:finalMarkets,
  diagnostics:{
   matchedRows,
   totalRows:markets.length,
   qualitySummary,
   premiumData:premium.diagnostics,
   playerWarehouse:{matchedRows:historical.matched,players:historical.players},
   playerFeatureFrames:{matchedRows:playerFrames.matched,players:playerFrames.players,frames:playerFrames.frames.length},
   playerCalibration:{matchedRows:playerCalibration.matched,profiles:playerCalibration.profiles},
   opponentMatchups:{matchedRows:opponentMatchups.matched,profiles:opponentMatchups.profiles,playerProfiles:opponentMatchups.playerProfiles},
   lineupRedistribution:{matchedRows:lineupRedistribution.matched,profiles:lineupRedistribution.profiles,activeAbsences:lineupRedistribution.activeAbsences},
   startingLineups:{matchedRows:startingLineups.matched,profiles:startingLineups.profiles,promotions:startingLineups.promotions},
   trainedSportMl:trainedSportMl.diagnostics,
   expertModels:externalExpert.diagnostics,
   publicNetwork:publicNetwork.diagnostics,
   providers:normalized.map(x=>({
    kind:x.kind,ok:x.ok,providerId:x.providerId,rowCount:x.rows.length,
    qualityScore:x.qualityScore,attempts:x.attempts
   }))
  }
 };
}
