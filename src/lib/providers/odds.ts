import {configuredProviders} from './config';
import {fetchProviderJson} from './http';
import {inspectProviderPayload,type PayloadQuality} from './payloadQuality';
import {eligibleOddsPayload,normalizeOddsPayload} from './normalizeOdds';
import {buildObservedOddsSnapshot} from '../observedOdds';
import {loadProviderHealthStates,recordProviderResult} from './healthStore';
import {providerHealth} from '../providerRegistry';
import {buildConsensusMarkets} from '../marketConsensus';
import type {Market,MarketRole} from '../types';
import type {ProviderConfig,ProviderFetchResult} from './types';

async function withDeadline<T>(promise:Promise<T>,ms:number,label:string):Promise<T>{
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{
  return await Promise.race([
   promise,
   new Promise<T>((_,reject)=>{timer=setTimeout(()=>reject(new Error(`${label} timeout after ${ms}ms`)),ms)})
  ]);
 }finally{
  if(timer)clearTimeout(timer);
 }
}

export type OddsAttempt={
 providerId:string;ok:boolean;latencyMs:number;error?:string;status?:number;
 skipped?:boolean;circuitState?:string;qualityGrade?:string;qualityScore?:number;
 rowCount?:number;payloadAgeMin?:number;acceptedMarkets?:number;
 observedReferenceMarkets?:number;
};

export type OddsIngestionResult={
 mode:'live'|'unconfigured'|'failed';
 providerId?:string;
 providerName?:string;
 markets:Market[];
 panelMarkets:Market[];
 referenceMarkets:Market[];
 rawCount:number;
 warnings:string[];
 attempts:OddsAttempt[];
 quality?:{grade:string;qualityScore:number;rowCount:number;payloadAgeMin?:number};
 degraded:boolean;
 targetBook:string;
 providerPanel:Array<{
  providerId:string;providerName:string;bookmaker:string;marketRole:string;
  configuredWeight:number;effectiveWeight:number;acceptedMarkets:number;
  sports:string[];
  sportCounts:Record<string,number>;
  playerPropRows:number;
  teamMarketRows:number;
  observedReferenceMarkets?:number;
  qualityGrade?:string;qualityScore?:number;latencyMs?:number;freshnessFactor?:number;transportScore?:number;
 }>;
 error?:string;
};

function configuredBookRoles(){
 try{
  const parsed=JSON.parse(process.env.ODDS_BOOK_ROLE_MAP||'{}') as Record<string,string>;
  const out:Record<string,MarketRole>={};
  for(const [book,value] of Object.entries(parsed)){
   const role=value.toUpperCase();
   if(role==='SHARP'||role==='PUBLIC'||role==='REFERENCE'||role==='NEUTRAL')out[book.trim().toLowerCase()]=role;
  }
  return out;
 }catch{return {} as Record<string,MarketRole>}
}

function configuredBookWeights(){
 try{
  const parsed=JSON.parse(process.env.ODDS_BOOK_WEIGHT_MAP||'{}') as Record<string,number>;
  const out:Record<string,number>={};
  for(const [book,value] of Object.entries(parsed)){
   const n=Number(value);
   if(Number.isFinite(n))out[book.trim().toLowerCase()]=Math.max(.1,Math.min(5,n));
  }
  return out;
 }catch{return {} as Record<string,number>}
}

type PanelResult={
 config:ProviderConfig;
 attempt:OddsAttempt;
 quality?:PayloadQuality;
 markets:Market[];
 referenceMarkets:Market[];
 rawCount:number;
 warnings:string[];
 effectiveWeight:number;
 freshnessFactor:number;
 transportScore:number;
};

async function fetchPanelProvider(config:ProviderConfig,healthScore:number,circuitState:string|undefined,quarantined:boolean):Promise<PanelResult>{
 if(quarantined){
  return {
   config,markets:[],referenceMarkets:[],rawCount:0,warnings:[],effectiveWeight:0,freshnessFactor:0,transportScore:0,
   attempt:{providerId:config.id,ok:false,latencyMs:0,skipped:true,circuitState:'OPEN',error:'Provider circuit is quarantined'}
  };
 }

 const providerDeadlineMs=Math.max(2500,Math.min(7000,config.timeoutMs||7000));
 let raw:ProviderFetchResult<unknown>;
 try{
  raw=await withDeadline(
   fetchProviderJson(config),
   providerDeadlineMs,
   `${config.id} provider`
  );
 }catch(error){
  raw={
   ok:false,
   providerId:config.id,
   providerName:config.name,
   capability:config.capability,
   latencyMs:providerDeadlineMs,
   receivedAt:new Date().toISOString(),
   status:504,
   error:error instanceof Error?error.message:'provider timeout'
  };
 }
 let quality:PayloadQuality|undefined;
 let markets:Market[]=[];
 let referenceMarkets:Market[]=[];
 let rawCount=0;
 let warnings:string[]=[];
 let accepted=raw.ok;
 let error=raw.error;

 if(raw.ok){
  quality=inspectProviderPayload(eligibleOddsPayload(raw.data),'ODDS',config.maxAgeMin);
  const normalized=normalizeOddsPayload(raw.data);
  referenceMarkets=normalized.markets.filter(m=>m.evidenceClass==='OBSERVED_REFERENCE')
   .map(m=>({...m,sourceProviderId:config.id}));
  markets=normalized.markets.filter(m=>m.evidenceClass!=='OBSERVED_REFERENCE');
  rawCount=normalized.rawCount;
  warnings=normalized.warnings;
  accepted=quality.ok&&markets.length>0;
  if(!markets.length&&referenceMarkets.length)error=`Observed ${referenceMarkets.length} reference quotes; bookmaker update time is unverified and recommendation eligibility remains blocked`;
  else if(!quality.ok)error=`Payload rejected: ${quality.reasons.join('; ')}`;
  else if(!markets.length)error=referenceMarkets.length
   ?`Observed ${referenceMarkets.length} reference quotes; bookmaker update time is unverified and recommendation eligibility remains blocked`
   :'Odds payload produced zero normalized markets';
  if(referenceMarkets.length)warnings.push(`${referenceMarkets.length} observed reference quotes are excluded from consensus, simulation and certified odds`);
 }

 const referenceOnly=markets.length===0&&buildObservedOddsSnapshot(referenceMarkets).referenceCount>0;
 const transportQuality=referenceOnly&&quality?{...quality,ok:true,grade:'CAUTION' as const,
  qualityScore:.6,freshnessScore:.35,newestTimestamp:undefined,payloadAgeMin:undefined,
  reasons:['Reference observations available; bookmaker source update time is unverified']}:quality;
 await withDeadline(
  recordProviderResult(config,{...raw,ok:accepted||referenceOnly,error} as typeof raw,transportQuality),
  1000,
  `${config.id} provider health write`
 ).catch(()=>undefined);

 const qualityWeight=quality?.qualityScore??.5;
 const latencyFactor=Math.max(.35,Math.min(1,2500/(2500+Math.max(0,raw.latencyMs))));
 const payloadAge=quality?.payloadAgeMin;
 const freshnessFactor=payloadAge===undefined
  ?1
  :Math.max(.35,Math.min(1,1-(payloadAge/Math.max(1,config.maxAgeMin))*0.65));
 const transportScore=Math.max(.08,qualityWeight*Math.max(.25,healthScore||.8)*latencyFactor*freshnessFactor);
 const effectiveWeight=Math.max(.1,config.consensusWeight)*transportScore;
 if(accepted){
  const bookRoles=configuredBookRoles();
  const bookWeights=configuredBookWeights();
  markets=markets.map(m=>{
   const sourceBook=m.sourceBook||config.bookmaker||config.name;
   const bookKey=sourceBook.trim().toLowerCase();
   return {
    ...m,
    sourceBook,
    sourceProviderId:config.id,
    marketRole:bookRoles[bookKey]||config.marketRole,
    sourceProviderWeight:effectiveWeight*(bookWeights[bookKey]||1)
   };
  });
 }else{
  markets=[];
 }

 return {
  config,markets,referenceMarkets,rawCount,warnings,effectiveWeight:accepted?effectiveWeight:0,
  freshnessFactor:accepted?freshnessFactor:0,
  transportScore:accepted?transportScore:0,
  quality,
  attempt:{
   providerId:config.id,ok:accepted,latencyMs:raw.latencyMs,error,status:raw.status,
   circuitState:circuitState||'CLOSED',qualityGrade:quality?.grade,qualityScore:quality?.qualityScore,
   rowCount:quality?.rowCount,payloadAgeMin:quality?.payloadAgeMin,acceptedMarkets:markets.length,
   observedReferenceMarkets:referenceMarkets.length
  }
 };
}

function coverageForMarkets(markets:Market[]){
 const sportCounts:Record<string,number>={};
 let playerPropRows=0;
 let teamMarketRows=0;
 for(const market of markets){
  const sport=String(market.sport||market.league||'Unknown');
  sportCounts[sport]=(sportCounts[sport]||0)+1;
  if(market.playerContext?.name||/^(player|pitcher|batter|goalie)[_\s-]/i.test(market.market))playerPropRows++;
  else teamMarketRows++;
 }
 return {
  sports:Object.keys(sportCounts).sort(),
  sportCounts,
  playerPropRows,
  teamMarketRows
 };
}

function aggregateQuality(rows:PanelResult[]){
 const accepted=rows.filter(x=>x.attempt.ok&&x.quality);
 if(!accepted.length)return undefined;
 const totalWeight=accepted.reduce((s,x)=>s+Math.max(.1,x.effectiveWeight),0);
 const qualityScore=accepted.reduce((s,x)=>s+(x.quality?.qualityScore??0)*Math.max(.1,x.effectiveWeight),0)/Math.max(.1,totalWeight);
 const rowCount=accepted.reduce((s,x)=>s+(x.quality?.rowCount??0),0);
 const ages=accepted.map(x=>x.quality?.payloadAgeMin).filter((x):x is number=>typeof x==='number'&&Number.isFinite(x));
 const payloadAgeMin=ages.length?Math.max(...ages):undefined;
 const grade=qualityScore>=.85?'TRUSTED':qualityScore>=.68?'USABLE':'CAUTION';
 return {grade,qualityScore,rowCount,payloadAgeMin};
}

async function fetchNormalizedOddsUncached():Promise<OddsIngestionResult>{
 const configured=configuredProviders('ODDS');
 const targetBook=process.env.TARGET_BOOKMAKER||'DraftKings';
 if(!configured.length){
  return {
   mode:'unconfigured',markets:[],panelMarkets:[],referenceMarkets:[],rawCount:0,warnings:[],attempts:[],degraded:true,
   targetBook,providerPanel:[],error:'No ODDS providers configured'
  };
 }

 const states=await withDeadline(
  loadProviderHealthStates(),
  1500,
  'provider health read'
 ).catch(()=>new Map());
 const now=Date.now();
 const panel=await Promise.all(configured.map(async config=>{
  const stored=states.get(config.id);
  const health=stored?providerHealth(stored,now):{score:.8,status:'HEALTHY',quarantined:false};
  try{
   return await fetchPanelProvider(config,health.score,stored?.circuitState,health.quarantined);
  }catch(error){
   return {
    config,markets:[],referenceMarkets:[],rawCount:0,warnings:[],effectiveWeight:0,freshnessFactor:0,transportScore:0,
    attempt:{
     providerId:config.id,ok:false,latencyMs:0,circuitState:stored?.circuitState||'CLOSED',
     error:error instanceof Error?error.name:'provider exception'
    }
   } as PanelResult;
  }
 }));

 const panelMarkets=panel.flatMap(x=>x.markets);
 const referenceMarkets=panel.flatMap(x=>x.referenceMarkets);
 const attempts=panel.map(x=>x.attempt);
 const accepted=panel.filter(x=>x.attempt.ok);
 if(!panelMarkets.length){
  return {
   mode:'failed',markets:[],panelMarkets:[],referenceMarkets,rawCount:panel.reduce((s,x)=>s+x.rawCount,0),
   warnings:panel.flatMap(x=>x.warnings),attempts,degraded:true,targetBook,
   providerPanel:panel.map(x=>({
    providerId:x.config.id,providerName:x.config.name,bookmaker:x.config.bookmaker||x.config.name,
    marketRole:x.config.marketRole,configuredWeight:x.config.consensusWeight,effectiveWeight:x.effectiveWeight,
    acceptedMarkets:x.markets.length,...coverageForMarkets(x.markets),observedReferenceMarkets:x.referenceMarkets.length,
    qualityGrade:x.quality?.grade,qualityScore:x.quality?.qualityScore,
    latencyMs:x.attempt.latencyMs,freshnessFactor:x.freshnessFactor,transportScore:x.transportScore
   })),
   error:'No configured odds provider produced acceptable normalized markets'
  };
 }

 const markets=buildConsensusMarkets(panelMarkets as Array<Market & {sourceProviderId:string;marketRole:any;sourceProviderWeight:number}>,targetBook);
 const targetRows=markets.filter(x=>x.consensus?.targetBookFound).length;
 const targetCoverage=markets.length?targetRows/markets.length:0;
 const warnings=[
  ...panel.flatMap(x=>x.warnings.map(w=>`${x.config.name}: ${w}`)),
  ...attempts.filter(x=>!x.ok&&!x.skipped).map(x=>`${x.providerId}: ${x.error||'provider rejected'}`),
  ...(targetCoverage===1?[]:[`Target bookmaker ${targetBook} present on ${targetRows}/${markets.length} consensus markets; best/reference price displayed where missing`]),
  ...(accepted.length<2?['Only one acceptable odds provider available; cross-provider consensus depth is limited']:[])
 ];

 const quality=aggregateQuality(panel);
 return {
  mode:'live',
  providerId:accepted.length>1?'consensus-panel':accepted[0].config.id,
  providerName:accepted.length>1?`Consensus Panel (${accepted.length} feeds)`:accepted[0].config.name,
  markets,panelMarkets,referenceMarkets,
  rawCount:panel.reduce((s,x)=>s+x.rawCount,0),
  warnings,attempts,quality,
  degraded:attempts.some(x=>!x.ok)||accepted.length<2||targetCoverage<.8,
  targetBook,
  providerPanel:panel.map(x=>({
   providerId:x.config.id,providerName:x.config.name,bookmaker:x.config.bookmaker||x.config.name,
   marketRole:x.config.marketRole,configuredWeight:x.config.consensusWeight,effectiveWeight:x.effectiveWeight,
   acceptedMarkets:x.markets.length,...coverageForMarkets(x.markets),observedReferenceMarkets:x.referenceMarkets.length,
   qualityGrade:x.quality?.grade,qualityScore:x.quality?.qualityScore,
   latencyMs:x.attempt.latencyMs,freshnessFactor:x.freshnessFactor,transportScore:x.transportScore
  }))
 };
}

let oddsPanelCache:{at:number;value:OddsIngestionResult}|null=null;
let oddsPanelInFlight:Promise<OddsIngestionResult>|null=null;
const oddsPanelCacheMs=()=>Math.max(1000,Number(process.env.ODDS_PANEL_CACHE_MS||5000));

export async function fetchNormalizedOdds():Promise<OddsIngestionResult>{
 const now=Date.now();
 if(oddsPanelCache&&now-oddsPanelCache.at<oddsPanelCacheMs())return oddsPanelCache.value;
 if(oddsPanelInFlight)return oddsPanelInFlight;
 const request=fetchNormalizedOddsUncached()
  .then(value=>{
   oddsPanelCache={at:Date.now(),value};
   return value;
  })
  .finally(()=>{
   if(oddsPanelInFlight===request)oddsPanelInFlight=null;
  });
 oddsPanelInFlight=request;
 return request;
}
