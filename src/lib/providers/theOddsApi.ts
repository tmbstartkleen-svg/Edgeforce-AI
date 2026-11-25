import {createHash} from 'node:crypto';
import type {ProviderConfig} from './types';
import {adaptiveOddsPolicy,estimateOddsRequestCost,type ActiveSport,type AdaptiveOddsPolicy} from './oddsRefreshPolicy';

type OddsEventRow={id?:string;sport_key?:string;sport_title?:string;commence_time?:string;[key:string]:unknown};
type Quota={remaining?:number;used?:number;last?:number};
type JsonResult<T>=Quota & {ok:boolean;status:number;data?:T;error?:string};

export type TheOddsApiAttempt={
 sportKey:string;events:number;oddsEvents:number;ok:boolean;status?:number;error?:string;
 cost?:number;estimatedCost?:number;remaining?:number;
};
export type TheOddsApiResult={
 ok:boolean;data:unknown[];attempts:TheOddsApiAttempt[];warnings:string[];
 discoveredSports:number;sportsWithEvents:number;fetchedSports:number;quota:Quota;
 policy?:AdaptiveOddsPolicy;error?:string;status?:number;retryAfterMs?:number;
 snapshotAt?:string;cacheAgeMs?:number;
};

type Settings={
 baseUrl:string;apiKey:string;timeoutMs:number;batchBudgetMs:number;cacheMs:number;failureCacheMs:number;
 reserve:number;maxSports:number;markets:string;expansionMarkets:string;bookmakers:string;regions:string;maxAgeMin:number;
};
type Cached={at:number;ttlMs:number;value:TheOddsApiResult};
const caches=new Map<string,Cached>();
const inFlight=new Map<string,Promise<TheOddsApiResult>>();
// This serializes one account within an isolate. It is not a distributed quota reservation.
const accountWork=new Map<string,Promise<TheOddsApiResult>>();
const MAX_CACHE_SCOPES=16;
const MIN_REQUEST_BUDGET_MS=250;
const int=(v:string|undefined,fallback:number)=>{
 const n=typeof v==='string'&&v.trim()?Number(v):NaN;
 return Number.isSafeInteger(n)&&n>=0?n:fallback;
};
const csv=(value:string)=>[...new Set(value.split(',').map(x=>x.trim().toLowerCase()).filter(Boolean))].join(',');
const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');

function settings(config:ProviderConfig):Settings{
 return {
  baseUrl:String(process.env.THE_ODDS_API_BASE_URL||'https://api.the-odds-api.com/v4').replace(/\/$/,''),
  apiKey:config.apiKey||process.env.THE_ODDS_API_KEY||'',
  timeoutMs:Math.max(1000,int(process.env.THE_ODDS_API_TIMEOUT_MS,10000)),
  // Finish before the odds panel's existing seven-second deadline; no late paid fan-out.
  batchBudgetMs:Math.max(1000,Math.min(6500,int(process.env.THE_ODDS_API_BATCH_BUDGET_MS,6500),
   Math.max(2500,Math.min(7000,config.timeoutMs||7000))-250)),
  cacheMs:Math.max(60000,Math.min(31*86400000,int(process.env.THE_ODDS_API_CACHE_MS,600000))),
  failureCacheMs:Math.max(5000,Math.min(3600000,int(process.env.THE_ODDS_API_FAILURE_CACHE_MS,60000))),
  reserve:int(process.env.THE_ODDS_API_CREDIT_RESERVE,25),
  maxSports:Math.min(20,int(process.env.THE_ODDS_API_EXPANSION_SPORTS,8)),
  markets:csv(process.env.THE_ODDS_API_MARKETS||'h2h,spreads,totals'),
  expansionMarkets:csv(process.env.THE_ODDS_API_EXPANSION_MARKETS||'h2h'),
  bookmakers:csv(process.env.THE_ODDS_API_BOOKMAKERS??'draftkings,fanduel,kalshi,polymarket,betmgm,williamhill_us'),
  regions:csv(process.env.THE_ODDS_API_REGIONS||'us'),
  maxAgeMin:Number.isFinite(config.maxAgeMin)&&config.maxAgeMin>0?config.maxAgeMin:20
 };
}

function headerNum(res:Response,name:string):number|undefined{
 const raw=res.headers.get(name);
 if(raw===null||!/^\d+$/.test(raw.trim()))return undefined;
 const n=Number(raw);
 return Number.isSafeInteger(n)&&n>=0?n:undefined;
}

function endpoint(options:Settings,path:string,params:Record<string,string>={}){
 const url=new URL(options.baseUrl+path);
 // Official v4 also accepts x-api-key; keep credentials out of URLs and diagnostics.
 for(const [key,value] of Object.entries(params))if(value)url.searchParams.set(key,value);
 return url.toString();
}

async function jsonRequest<T>(options:Settings,url:string,deadline:number):Promise<JsonResult<T>>{
 const budget=Math.min(options.timeoutMs,deadline-Date.now());
 if(budget<MIN_REQUEST_BUDGET_MS)return {ok:false,status:504,error:'The Odds API batch deadline reached; no request started'};
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),budget);
 try{
  const res=await fetch(url,{headers:{Accept:'application/json','x-api-key':options.apiKey},cache:'no-store',redirect:'error',signal:controller.signal});
  const quota={remaining:headerNum(res,'x-requests-remaining'),used:headerNum(res,'x-requests-used'),last:headerNum(res,'x-requests-last')};
  if(!res.ok){
   let detail='';
   try{
    const body=await res.text();
    if(body){
     try{
      const parsed=JSON.parse(body) as Record<string,unknown>;
      detail=[parsed.message,parsed.error,parsed.error_code].filter(x=>typeof x==='string').join(' | ');
     }catch{detail='Provider returned a non-JSON error';}
    }
   }catch{}
   detail=detail.split(options.apiKey).join('[REDACTED]').split(encodeURIComponent(options.apiKey)).join('[REDACTED]')
    .replace(/\s+/g,' ').trim().slice(0,400);
   return {ok:false,status:res.status,error:detail?`HTTP ${res.status}: ${detail}`:`HTTP ${res.status}`,...quota};
  }
  return {ok:true,status:res.status,data:await res.json() as T,...quota};
 }catch{
  return {ok:false,status:controller.signal.aborted?504:502,error:controller.signal.aborted?'The Odds API request timed out':'The Odds API transport or response failed'};
 }finally{clearTimeout(timer);}
}

function uniqueEvents(rows:unknown[]){
 const seen=new Set<string>();
 return rows.filter(raw=>{
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return false;
  const row=raw as OddsEventRow,key=String(row.id||JSON.stringify(raw));
  if(seen.has(key))return false;seen.add(key);return true;
 });
}
function nearestStartMinutes(rows:unknown[]){
 const now=Date.now();
 const times=rows.map(x=>Date.parse(String((x as OddsEventRow).commence_time||''))).filter(x=>Number.isFinite(x)&&x>=now);
 return times.length?Math.max(0,(Math.min(...times)-now)/60000):undefined;
}

async function loadBoard(options:Settings,deadline:number):Promise<TheOddsApiResult>{
 const warnings:string[]=[],attempts:TheOddsApiAttempt[]=[];
 let quota:Quota={};
 const fail=(error:string,status=503,retryAfterMs=options.failureCacheMs):TheOddsApiResult=>({
  ok:false,data:[],attempts,warnings,discoveredSports:0,sportsWithEvents:0,fetchedSports:attempts.length,
  quota,error,status,retryAfterMs
 });
 const updateQuota=(result:Quota)=>{quota={remaining:result.remaining,used:result.used,last:result.last};};
 const guard=(cost:number)=>{
  if(deadline-Date.now()<MIN_REQUEST_BUDGET_MS)return 'The Odds API batch deadline reached; no further paid request started';
  if(quota.remaining===undefined)return 'THE_ODDS_API_QUOTA_UNVERIFIED: no paid request permitted without a valid remaining-credit header';
  if(quota.remaining-cost<options.reserve)return `THE_ODDS_API_CREDIT_RESERVE: ${quota.remaining} remaining cannot cover estimated cost ${cost} and preserve ${options.reserve} reserved credits`;
  return null;
 };
 const paid=async(sportKey:string,path:string,params:Record<string,string>)=>{
  const cost=estimateOddsRequestCost(params),blocked=guard(cost);
  if(blocked)return {ok:false,status:503,error:blocked,blocked:true} as JsonResult<unknown[]> & {blocked:boolean};
  const result=await jsonRequest<unknown[]>(options,endpoint(options,path,params),deadline);
  updateQuota(result);
  const data=Array.isArray(result.data)?result.data:[];
  attempts.push({sportKey,events:data.length,oddsEvents:data.length,ok:result.ok,status:result.status,
   error:result.error,cost:result.last,estimatedCost:cost,remaining:result.remaining});
  return {...result,blocked:false};
 };

 // /sports is quota-free and returns the same quota headers. Never bootstrap paid odds first.
 const catalog=await jsonRequest<ActiveSport[]>(options,endpoint(options,'/sports/'),deadline);
 updateQuota(catalog);
 if(!catalog.ok||!Array.isArray(catalog.data))return fail(catalog.error||'The Odds API quota preflight returned an invalid sports catalog',catalog.ok?502:catalog.status||502,
  catalog.status===429?300000:options.failureCacheMs);
 if(quota.remaining===undefined)return fail('THE_ODDS_API_QUOTA_UNVERIFIED: free catalog did not provide a valid remaining-credit header; no paid request made',503,Math.max(options.cacheMs,options.failureCacheMs));
 const activeSports=catalog.data.filter(x=>x&&typeof x==='object'&&typeof x.key==='string'&&x.key.trim()&&x.active!==false&&!x.has_outrights);
 const params={regions:options.regions,bookmakers:options.bookmakers,markets:options.markets,oddsFormat:'american',dateFormat:'iso'};
 let bootstrap=await paid('upcoming','/sports/upcoming/odds',params);
 let bootstrapData=Array.isArray(bootstrap.data)?bootstrap.data:[];
 if(bootstrap.ok&&!Array.isArray(bootstrap.data))return fail('The Odds API returned an invalid odds array',502);

 if(!bootstrap.blocked&&((!bootstrap.ok&&(bootstrap.status===400||bootstrap.status===422))||(bootstrap.ok&&bootstrapData.length===0))){
  warnings.push('Primary upcoming-odds bootstrap was rejected or empty; considering the provider-safe US h2h baseline within the remaining budget');
  const fallback=await paid('upcoming-us-h2h','/sports/upcoming/odds',{regions:'us',markets:'h2h',oddsFormat:'american',dateFormat:'iso'});
  bootstrap=fallback;bootstrapData=Array.isArray(fallback.data)?fallback.data:[];
  if(fallback.ok&&bootstrapData.length)warnings.push(`Provider-safe bootstrap recovered ${bootstrapData.length} live event(s)`);
 }
 if(!bootstrap.ok||bootstrapData.length===0){
  const cooldown=bootstrap.blocked?Math.max(options.cacheMs,options.failureCacheMs):bootstrap.status===429?300000:options.failureCacheMs;
  return fail(bootstrap.error||'No live sportsbook odds returned',bootstrap.status||502,cooldown);
 }
 bootstrapData=uniqueEvents(bootstrapData);
 const covered=new Set(bootstrapData.map(x=>String((x as OddsEventRow).sport_key||'')).filter(Boolean));
 const policy=adaptiveOddsPolicy({remaining:quota.remaining,reserve:options.reserve,configuredMaxSports:options.maxSports,
  alreadyCovered:covered,activeSports,nearestStartMinutes:nearestStartMinutes(bootstrapData),
  expansionMarkets:options.expansionMarkets,bootstrapMarkets:options.markets,regions:options.regions,bookmakers:options.bookmakers,
  rotationOffset:Math.floor(Date.now()/3600000)});
 const expanded:unknown[]=[];
 const expansionSports:string[]=[];
 for(const sportKey of policy.selectedSports){
  const expansionParams={...params,markets:options.expansionMarkets};
  const blocked=guard(estimateOddsRequestCost(expansionParams));
  if(blocked){warnings.push(blocked);break;}
  // Preserve serialized pacing, but do not start work that outlives the panel's deadline.
  if(deadline-Date.now()<650+MIN_REQUEST_BUDGET_MS){warnings.push('The Odds API batch deadline prevents further sport expansion');break;}
  await sleep(650);
  const result=await paid(sportKey,`/sports/${encodeURIComponent(sportKey)}/odds`,expansionParams);
  if(result.blocked){warnings.push(result.error||'Paid expansion blocked');break;}
  expansionSports.push(sportKey);
  if(result.ok&&Array.isArray(result.data))expanded.push(...result.data);
  if(!result.ok){warnings.push(result.error||`Expansion failed for ${sportKey}`);break;}
 }
 const data=uniqueEvents([...bootstrapData,...expanded]);
 warnings.unshift(`Adaptive full-slate ${policy.mode}: bootstrap ${bootstrapData.length} event(s) + ${expansionSports.length} sport expansion request(s) (${options.expansionMarkets}); refresh target ${policy.refreshMinutes}m`);
 if(policy.reasons.length)warnings.push(`Refresh policy: ${policy.reasons.join('; ')}`);
 if(quota.remaining===undefined)warnings.push('Remaining quota is unverified after the last response; no additional paid requests permitted');
 return {ok:data.length>0,status:200,data,attempts,warnings,discoveredSports:activeSports.length,
  sportsWithEvents:new Set(data.map(x=>String((x as OddsEventRow).sport_key||'')).filter(Boolean)).size,
  fetchedSports:attempts.length,quota,policy:{...policy,selectedSports:expansionSports},
  error:data.length?undefined:'No live sportsbook odds returned'};
}

function cachedResult(cache:Cached,options:Settings):TheOddsApiResult{
 const ageMs=Math.max(0,Date.now()-cache.at);
 const stale=cache.value.ok&&ageMs>options.maxAgeMin*60000;
 return {...cache.value,snapshotAt:new Date(cache.at).toISOString(),cacheAgeMs:ageMs,
  ...(stale?{ok:false,status:503,error:`THE_ODDS_API_CACHE_STALE: stored response is ${(ageMs/60000).toFixed(1)}m old; original quote timestamps are preserved and the configured paid refresh cadence has not been accelerated`,
   retryAfterMs:Math.max(0,cache.at+cache.ttlMs-Date.now())}:{}),
  ...(!cache.value.ok?{retryAfterMs:Math.max(0,cache.at+cache.ttlMs-Date.now())}:{})};
}

export async function fetchTheOddsApiBoard(config:ProviderConfig):Promise<TheOddsApiResult>{
 const options=settings(config);
 if(!options.apiKey||options.apiKey==='[SENSITIVE]'||/[\s\u0000-\u001f\u007f]/.test(options.apiKey))return {
  ok:false,data:[],attempts:[],warnings:[],discoveredSports:0,sportsWithEvents:0,fetchedSports:0,quota:{},status:503,error:'THE_ODDS_API_KEY is not configured or valid'
 };
 const account=digest([options.baseUrl,options.apiKey]);
 const scope=digest([config.id,options]);
 const stored=caches.get(scope);
 if(stored&&Date.now()-stored.at>=0&&Date.now()-stored.at<stored.ttlMs)return cachedResult(stored,options);
 const existing=inFlight.get(scope);
 if(existing)return existing;
 const deadline=Date.now()+options.batchBudgetMs;
 const previous=accountWork.get(account);
 const request=(async()=>{
  if(previous)await previous.catch(()=>undefined);
  const value=await loadBoard(options,deadline);
  const ttlMs=value.ok?Math.max(options.cacheMs,(value.policy?.refreshMinutes||0)*60000):Math.max(options.failureCacheMs,value.retryAfterMs||0);
  const cached={at:Date.now(),ttlMs,value};
  caches.delete(scope);caches.set(scope,cached);
  while(caches.size>MAX_CACHE_SCOPES)caches.delete(caches.keys().next().value!);
  return cachedResult(cached,options);
 })();
 inFlight.set(scope,request);accountWork.set(account,request);
 try{return await request;}finally{
  if(inFlight.get(scope)===request)inFlight.delete(scope);
  if(accountWork.get(account)===request)accountWork.delete(account);
 }
}
