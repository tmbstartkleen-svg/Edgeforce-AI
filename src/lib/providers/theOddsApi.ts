import type {ProviderConfig} from './types';
import {adaptiveOddsPolicy,type ActiveSport,type AdaptiveOddsPolicy} from './oddsRefreshPolicy';

type OddsEventRow={id?:string;sport_key?:string;sport_title?:string;commence_time?:string;[key:string]:unknown};

export type TheOddsApiAttempt={
 sportKey:string;
 events:number;
 oddsEvents:number;
 ok:boolean;
 status?:number;
 error?:string;
 cost?:number;
 remaining?:number;
};

export type TheOddsApiResult={
 ok:boolean;
 data:unknown[];
 attempts:TheOddsApiAttempt[];
 warnings:string[];
 discoveredSports:number;
 sportsWithEvents:number;
 fetchedSports:number;
 quota:{remaining?:number;used?:number;last?:number};
 policy?:AdaptiveOddsPolicy;
 error?:string;
};

const base=()=>String(process.env.THE_ODDS_API_BASE_URL||'https://api.the-odds-api.com/v4').replace(/\/$/,'');
let cache:{at:number;ttlMs:number;value:TheOddsApiResult}|null=null;
const failureCacheMs=()=>Math.max(5000,int(process.env.THE_ODDS_API_FAILURE_CACHE_MS,60000));
const int=(v:string|undefined,fallback:number)=>{const n=Number(v);return Number.isFinite(n)?Math.floor(n):fallback};
const headerNum=(res:Response,name:string)=>{
 const n=Number(res.headers.get(name));
 return Number.isFinite(n)?n:undefined;
};
const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));

async function jsonRequest<T>(url:string,timeoutMs=10000):Promise<{ok:boolean;status:number;data?:T;error?:string;remaining?:number;used?:number;last?:number}>{
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{
  const res=await fetch(url,{headers:{Accept:'application/json'},cache:'no-store',signal:controller.signal});
  const quota={remaining:headerNum(res,'x-requests-remaining'),used:headerNum(res,'x-requests-used'),last:headerNum(res,'x-requests-last')};
  if(!res.ok){
   let detail='';
   try{
    const body=await res.text();
    if(body){
     try{
      const parsed=JSON.parse(body) as Record<string,unknown>;
      const candidate=parsed.message??parsed.error??parsed.error_code;
      detail=typeof candidate==='string'?candidate:body;
     }catch{
      detail=body;
     }
    }
   }catch{}
   detail=detail.replace(/\s+/g,' ').trim().slice(0,400);
   return {ok:false,status:res.status,error:detail?`HTTP ${res.status}: ${detail}`:`HTTP ${res.status}`,...quota};
  }
  return {ok:true,status:res.status,data:await res.json() as T,...quota};
 }catch(error){
  return {ok:false,status:0,error:error instanceof Error?error.message:'request failed'};
 }finally{clearTimeout(timer)}
}

async function jsonRequestWith429Retry<T>(url:string,timeoutMs=10000){
 let result=await jsonRequest<T>(url,timeoutMs);
 if(result.status===429){
  await sleep(2500);
  result=await jsonRequest<T>(url,timeoutMs);
 }
 return result;
}

function withKey(path:string,key:string,params:Record<string,string>={}){
 const url=new URL(base()+path);
 url.searchParams.set('apiKey',key);
 for(const [k,v] of Object.entries(params))if(v)url.searchParams.set(k,v);
 return url.toString();
}

function uniqueEvents(rows:unknown[]){
 const seen=new Set<string>();
 const out:unknown[]=[];
 for(const raw of rows){
  const row=raw as OddsEventRow;
  const key=String(row.id||JSON.stringify(raw));
  if(seen.has(key))continue;
  seen.add(key);
  out.push(raw);
 }
 return out;
}

function nearestStartMinutes(rows:unknown[]){
 const now=Date.now();
 const times=rows.map(x=>new Date(String((x as OddsEventRow).commence_time||'')).getTime())
  .filter(x=>Number.isFinite(x)&&x>=now);
 if(!times.length)return undefined;
 return Math.max(0,(Math.min(...times)-now)/60000);
}

export async function fetchTheOddsApiBoard(config:ProviderConfig):Promise<TheOddsApiResult>{
 if(cache&&Date.now()-cache.at<cache.ttlMs)return cache.value;

 const key=config.apiKey||process.env.THE_ODDS_API_KEY;
 if(!key)return {ok:false,data:[],attempts:[],warnings:[],discoveredSports:0,sportsWithEvents:0,fetchedSports:0,quota:{},error:'THE_ODDS_API_KEY is not configured'};

 const timeoutMs=Math.max(3000,int(process.env.THE_ODDS_API_TIMEOUT_MS,10000));
 const configuredCacheMs=Math.max(60000,int(process.env.THE_ODDS_API_CACHE_MS,600000));
 const reserve=Math.max(0,int(process.env.THE_ODDS_API_CREDIT_RESERVE,25));
 const configuredMaxSports=Math.max(0,Math.min(20,int(process.env.THE_ODDS_API_EXPANSION_SPORTS,8)));
 const expansionMarkets=String(process.env.THE_ODDS_API_EXPANSION_MARKETS||'h2h');
 const markets=String(process.env.THE_ODDS_API_MARKETS||'h2h,spreads,totals');
 const bookmakers=String(process.env.THE_ODDS_API_BOOKMAKERS||'draftkings,fanduel,kalshi,polymarket,betmgm,williamhill_us');
 const regions=String(process.env.THE_ODDS_API_REGIONS||'us');
 const warnings:string[]=[];
 const attempts:TheOddsApiAttempt[]=[];

 // One paid bootstrap call establishes immediate live connectivity and the nearest 8 events.
 const bootstrapUrl=withKey('/sports/upcoming/odds',key,{
  regions,bookmakers,markets,oddsFormat:'american',dateFormat:'iso'
 });
 let bootstrap=await jsonRequestWith429Retry<unknown[]>(bootstrapUrl,timeoutMs);
 let bootstrapData=Array.isArray(bootstrap.data)?bootstrap.data:[];
 let bootstrapError=bootstrap.error;
 attempts.push({
  sportKey:'upcoming',events:bootstrapData.length,oddsEvents:bootstrapData.length,ok:bootstrap.ok,
  status:bootstrap.status,error:bootstrap.error,cost:bootstrap.last,remaining:bootstrap.remaining
 });

 if((!bootstrap.ok&&(bootstrap.status===400||bootstrap.status===422))||(bootstrap.ok&&bootstrapData.length===0)){
  warnings.push('Primary upcoming-odds bootstrap was rejected or empty; retrying with the provider-safe US h2h baseline');
  const fallbackUrl=withKey('/sports/upcoming/odds',key,{
   regions:'us',markets:'h2h',oddsFormat:'american',dateFormat:'iso'
  });
  const fallback=await jsonRequestWith429Retry<unknown[]>(fallbackUrl,timeoutMs);
  const fallbackData=Array.isArray(fallback.data)?fallback.data:[];
  attempts.push({
   sportKey:'upcoming-us-h2h',events:fallbackData.length,oddsEvents:fallbackData.length,ok:fallback.ok,
   status:fallback.status,error:fallback.error,cost:fallback.last,remaining:fallback.remaining
  });
  if(fallback.ok&&fallbackData.length){
   bootstrap=fallback;
   bootstrapData=fallbackData;
   bootstrapError=undefined;
   warnings.push(`Provider-safe bootstrap recovered ${fallbackData.length} live event(s)`);
  }else{
   bootstrapError=fallback.error||bootstrapError;
  }
 }

 if(!bootstrap.ok||bootstrapData.length===0){
  const value:TheOddsApiResult={
   ok:false,data:[],attempts,warnings:['Adaptive full-slate bootstrap failed',...warnings],discoveredSports:0,
   sportsWithEvents:0,fetchedSports:attempts.length,
   quota:{remaining:bootstrap.remaining,used:bootstrap.used,last:bootstrap.last},
   error:bootstrapError||'No live sportsbook odds returned'
  };
  cache={at:Date.now(),ttlMs:failureCacheMs(),value};
  return value;
 }

 let remaining=bootstrap.remaining;
 let used=bootstrap.used;
 let last=bootstrap.last;
 const covered=new Set(bootstrapData.map(x=>String((x as OddsEventRow).sport_key||'')).filter(Boolean));

 // /sports is free. If it fails, the verified upcoming feed still remains usable.
 const sportsResponse=await jsonRequestWith429Retry<ActiveSport[]>(withKey('/sports/',key),timeoutMs);
 const activeSports=Array.isArray(sportsResponse.data)
  ?sportsResponse.data.filter(x=>x.active!==false&&!x.has_outrights)
  :[];

 const policy=adaptiveOddsPolicy({
  remaining,
  reserve,
  configuredMaxSports,
  alreadyCovered:covered,
  activeSports,
  nearestStartMinutes:nearestStartMinutes(bootstrapData),
  expansionMarkets,
  rotationOffset:Math.floor(Date.now()/3600000)
 });

 const expanded:unknown[]=[];
 if(!sportsResponse.ok)warnings.push(`Free active-sports discovery failed: ${sportsResponse.error||sportsResponse.status}`);

 for(const sportKey of policy.selectedSports){
  if(remaining!==undefined&&remaining<=reserve){
   warnings.push(`Expansion stopped at the configured reserve of ${reserve} credits`);
   break;
  }

  const url=withKey(`/sports/${encodeURIComponent(sportKey)}/odds`,key,{
   regions,bookmakers,markets:expansionMarkets,oddsFormat:'american',dateFormat:'iso'
  });
  const result=await jsonRequestWith429Retry<unknown[]>(url,timeoutMs);
  const data=Array.isArray(result.data)?result.data:[];

  attempts.push({
   sportKey,events:data.length,oddsEvents:data.length,ok:result.ok,status:result.status,error:result.error,
   cost:result.last,remaining:result.remaining
  });

  if(result.remaining!==undefined)remaining=result.remaining;
  if(result.used!==undefined)used=result.used;
  if(result.last!==undefined)last=result.last;

  if(result.ok&&data.length)expanded.push(...data);
  if(result.status===429){
   warnings.push(`Expansion paused after ${sportKey} remained rate limited after retry`);
   break;
  }

  // Paid expansion is deliberately serialized to avoid provider bursts.
  await sleep(650);
 }

 const data=uniqueEvents([...bootstrapData,...expanded]);
 const expandedWithEvents=attempts.slice(1).filter(x=>x.ok&&x.oddsEvents>0).length;
 const actualExpansionSports=attempts.slice(1).map(x=>x.sportKey);

 warnings.unshift(
  `Adaptive full-slate ${policy.mode}: bootstrap ${bootstrapData.length} event(s) + ${actualExpansionSports.length} sport expansion request(s) (${expansionMarkets}); refresh target ${policy.refreshMinutes}m`
 );
 if(data.length)warnings.push(`Live board contains ${data.length} unique event(s) across bootstrap and prioritized expansion`);
 if(policy.reasons.length)warnings.push(`Refresh policy: ${policy.reasons.join('; ')}`);

 const value:TheOddsApiResult={
  ok:data.length>0,
  data,
  attempts,
  warnings,
  discoveredSports:activeSports.length,
  sportsWithEvents:(bootstrapData.length?1:0)+expandedWithEvents,
  fetchedSports:attempts.length,
  quota:{remaining,used,last},
  policy:{...policy,selectedSports:actualExpansionSports},
  error:data.length?undefined:'No live sportsbook odds returned'
 };

 const policyTtlMs=Math.max(configuredCacheMs,policy.refreshMinutes*60000);
 cache={at:Date.now(),ttlMs:value.ok?policyTtlMs:failureCacheMs(),value};
 return value;
}
