import {configuredProviders} from './config';
import {fetchProviderJson} from './http';
import {inspectProviderPayload,type PayloadQuality} from './payloadQuality';
import {normalizeOddsPayload} from './normalizeOdds';
import {loadProviderHealthStates,recordProviderResult} from './healthStore';
import {providerHealth} from '../providerRegistry';
import {buildConsensusMarkets} from '../marketConsensus';
import type {Market,MarketRole} from '../types';
import type {ProviderConfig} from './types';

export type OddsAttempt={
 providerId:string;ok:boolean;latencyMs:number;error?:string;status?:number;
 skipped?:boolean;circuitState?:string;qualityGrade?:string;qualityScore?:number;
 rowCount?:number;payloadAgeMin?:number;acceptedMarkets?:number;
};

export type OddsIngestionResult={
 mode:'live'|'unconfigured'|'failed';
 providerId?:string;
 providerName?:string;
 markets:Market[];
 panelMarkets:Market[];
 rawCount:number;
 warnings:string[];
 attempts:OddsAttempt[];
 quality?:{grade:string;qualityScore:number;rowCount:number;payloadAgeMin?:number};
 degraded:boolean;
 targetBook:string;
 providerPanel:Array<{
  providerId:string;providerName:string;bookmaker:string;marketRole:string;
  configuredWeight:number;effectiveWeight:number;acceptedMarkets:number;
  qualityGrade?:string;qualityScore?:number;
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
 rawCount:number;
 warnings:string[];
 effectiveWeight:number;
};

async function fetchPanelProvider(config:ProviderConfig,healthScore:number,circuitState:string|undefined,quarantined:boolean):Promise<PanelResult>{
 if(quarantined){
  return {
   config,markets:[],rawCount:0,warnings:[],effectiveWeight:0,
   attempt:{providerId:config.id,ok:false,latencyMs:0,skipped:true,circuitState:'OPEN',error:'Provider circuit is quarantined'}
  };
 }

 const raw=await fetchProviderJson(config);
 let quality:PayloadQuality|undefined;
 let markets:Market[]=[];
 let rawCount=0;
 let warnings:string[]=[];
 let accepted=raw.ok;
 let error=raw.error;

 if(raw.ok){
  quality=inspectProviderPayload(raw.data,'ODDS',config.maxAgeMin);
  const normalized=normalizeOddsPayload(raw.data);
  markets=normalized.markets;
  rawCount=normalized.rawCount;
  warnings=normalized.warnings;
  accepted=quality.ok&&markets.length>0;
  if(!quality.ok)error=`Payload rejected: ${quality.reasons.join('; ')}`;
  else if(!markets.length)error='Odds payload produced zero normalized markets';
 }

 await recordProviderResult(config,{...raw,ok:accepted,error} as typeof raw,quality).catch(()=>undefined);

 const qualityWeight=quality?.qualityScore??.5;
 const effectiveWeight=Math.max(.1,config.consensusWeight)*Math.max(.15,qualityWeight)*Math.max(.25,healthScore||.8);
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
  config,markets,rawCount,warnings,effectiveWeight:accepted?effectiveWeight:0,
  quality,
  attempt:{
   providerId:config.id,ok:accepted,latencyMs:raw.latencyMs,error,status:raw.status,
   circuitState:circuitState||'CLOSED',qualityGrade:quality?.grade,qualityScore:quality?.qualityScore,
   rowCount:quality?.rowCount,payloadAgeMin:quality?.payloadAgeMin,acceptedMarkets:markets.length
  }
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

export async function fetchNormalizedOdds():Promise<OddsIngestionResult>{
 const configured=configuredProviders('ODDS');
 const targetBook=process.env.TARGET_BOOKMAKER||'DraftKings';
 if(!configured.length){
  return {
   mode:'unconfigured',markets:[],panelMarkets:[],rawCount:0,warnings:[],attempts:[],degraded:true,
   targetBook,providerPanel:[],error:'No ODDS providers configured'
  };
 }

 const states=await loadProviderHealthStates();
 const now=Date.now();
 const panel=await Promise.all(configured.map(config=>{
  const stored=states.get(config.id);
  const health=stored?providerHealth(stored,now):{score:.8,status:'HEALTHY',quarantined:false};
  return fetchPanelProvider(config,health.score,stored?.circuitState,health.quarantined);
 }));

 const panelMarkets=panel.flatMap(x=>x.markets);
 const attempts=panel.map(x=>x.attempt);
 const accepted=panel.filter(x=>x.attempt.ok);
 if(!panelMarkets.length){
  return {
   mode:'failed',markets:[],panelMarkets:[],rawCount:panel.reduce((s,x)=>s+x.rawCount,0),
   warnings:panel.flatMap(x=>x.warnings),attempts,degraded:true,targetBook,
   providerPanel:panel.map(x=>({
    providerId:x.config.id,providerName:x.config.name,bookmaker:x.config.bookmaker||x.config.name,
    marketRole:x.config.marketRole,configuredWeight:x.config.consensusWeight,effectiveWeight:x.effectiveWeight,
    acceptedMarkets:x.markets.length,qualityGrade:x.quality?.grade,qualityScore:x.quality?.qualityScore
   })),
   error:'No configured odds provider produced acceptable normalized markets'
  };
 }

 const markets=buildConsensusMarkets(panelMarkets as Array<Market & {sourceProviderId:string;marketRole:any;sourceProviderWeight:number}>,targetBook);
 const targetFound=markets.some(x=>x.consensus?.targetBookFound);
 const warnings=[
  ...panel.flatMap(x=>x.warnings.map(w=>`${x.config.name}: ${w}`)),
  ...attempts.filter(x=>!x.ok&&!x.skipped).map(x=>`${x.providerId}: ${x.error||'provider rejected'}`),
  ...(targetFound?[]:[`Target bookmaker ${targetBook} not present in accepted consensus quotes; best/reference price displayed`]),
  ...(accepted.length<2?['Only one acceptable odds provider available; cross-provider consensus depth is limited']:[])
 ];

 const quality=aggregateQuality(panel);
 return {
  mode:'live',
  providerId:accepted.length>1?'consensus-panel':accepted[0].config.id,
  providerName:accepted.length>1?`Consensus Panel (${accepted.length} feeds)`:accepted[0].config.name,
  markets,panelMarkets,
  rawCount:panel.reduce((s,x)=>s+x.rawCount,0),
  warnings,attempts,quality,
  degraded:attempts.some(x=>!x.ok)||accepted.length<2||!targetFound,
  targetBook,
  providerPanel:panel.map(x=>({
   providerId:x.config.id,providerName:x.config.name,bookmaker:x.config.bookmaker||x.config.name,
   marketRole:x.config.marketRole,configuredWeight:x.config.consensusWeight,effectiveWeight:x.effectiveWeight,
   acceptedMarkets:x.markets.length,qualityGrade:x.quality?.grade,qualityScore:x.quality?.qualityScore
  }))
 };
}
