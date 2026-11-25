import {createHash} from 'node:crypto';
import type {ProviderConfig,ProviderDiagnostics,ProviderFailureKind,ProviderRequestDiagnostic} from './types';
import {adaptiveOddsPolicy,estimateOddsRequestCost,type ActiveSport,type AdaptiveOddsPolicy} from './oddsRefreshPolicy';

type OddsEventRow={id?:string;sport_key?:string;sport_title?:string;commence_time?:string;[key:string]:unknown};
type Quota={remaining?:number;used?:number;last?:number};
type JsonResult<T>=Quota & {ok:boolean;status:number;data?:T;error?:string;diagnostic:ProviderRequestDiagnostic};

export type TheOddsApiAttempt={
 sportKey:string;events:number;oddsEvents:number;ok:boolean;status?:number;error?:string;
 cost?:number;estimatedCost?:number;remaining?:number;
};
export type TheOddsApiResult={
 ok:boolean;data:unknown[];attempts:TheOddsApiAttempt[];warnings:string[];
 discoveredSports:number;sportsWithEvents:number;fetchedSports:number;quota:Quota;
 policy?:AdaptiveOddsPolicy;error?:string;status?:number;retryAfterMs?:number;
 snapshotAt?:string;cacheAgeMs?:number;diagnostics:ProviderDiagnostics;
};

type Settings={
 baseUrl:string;apiKey:string;timeoutMs:number;batchBudgetMs:number;cacheMs:number;failureCacheMs:number;
 reserve:number;preflightOnly:boolean;maxSports:number;markets:string;expansionMarkets:string;bookmakers:string;regions:string;maxAgeMin:number;
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
  preflightOnly:process.env.THE_ODDS_API_PREFLIGHT_ONLY==='true'||process.env.DEPLOYMENT_ENV==='production'||process.env.VERCEL_ENV==='production',
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

const PROVIDER_ERROR_CODES=new Set([
 'MISSING_KEY','INVALID_KEY','DEACTIVATED_KEY','EXCEEDED_FREQ_LIMIT','OUT_OF_USAGE_CREDITS',
 'MISSING_REGION','INVALID_REGION','INVALID_BOOKMAKERS','MISSING_MARKET','INVALID_MARKET','INVALID_MARKET_COMBO',
 'INVALID_DATE_FORMAT','INVALID_ODDS_FORMAT','INVALID_ALL_SPORTS_PARAM','INVALID_SPORT','UNKNOWN_SPORT',
 'INVALID_EVENT_IDS','INVALID_EVENT_ID','EVENT_NOT_FOUND','HISTORICAL_UNAVAILABLE_ON_FREE_USAGE_PLAN'
]);
const TRANSPORT_CODES=new Set(['ECONNRESET','ECONNREFUSED','ENOTFOUND','EAI_AGAIN','ETIMEDOUT',
 'UND_ERR_CONNECT_TIMEOUT','UND_ERR_HEADERS_TIMEOUT','UND_ERR_BODY_TIMEOUT','UND_ERR_SOCKET',
 'CERT_HAS_EXPIRED','UNABLE_TO_VERIFY_LEAF_SIGNATURE','DEPTH_ZERO_SELF_SIGNED_CERT','ERR_TLS_CERT_ALTNAME_INVALID']);
const ERROR_NAMES=new Set(['Error','TypeError','AbortError','TimeoutError','NetworkError']);
const MAX_SUCCESS_BODY_BYTES=4*1024*1024;
const MAX_ERROR_BODY_BYTES=16*1024;

class RequestFailure extends Error{
 constructor(public kind:ProviderFailureKind,public evidence:Partial<Pick<ProviderRequestDiagnostic,'transportCode'|'transportErrorName'>>={}){super(kind);}
}
function requestDiagnostic(stage:ProviderRequestDiagnostic['stage'],endpointCode:ProviderRequestDiagnostic['endpoint']):ProviderRequestDiagnostic{
 return {stage,endpoint:endpointCode,attempted:false,responseReceived:false,startedAt:new Date().toISOString(),elapsedMs:0,responseBytes:0,quota:{}};
}
function transportEvidence(error:unknown){
 const e=error&&typeof error==='object'?error as {name?:unknown;code?:unknown;cause?:unknown}:{};
 const cause=e.cause&&typeof e.cause==='object'?e.cause as {code?:unknown}:{};
 const code=typeof e.code==='string'&&TRANSPORT_CODES.has(e.code)?e.code:
  typeof cause.code==='string'&&TRANSPORT_CODES.has(cause.code)?cause.code:undefined;
 const name=typeof e.name==='string'&&ERROR_NAMES.has(e.name)?e.name:undefined;
 return {...(code?{transportCode:code}:{}),...(name?{transportErrorName:name}:{})};
}
function timeoutEvidence(evidence:ReturnType<typeof transportEvidence>){
 return evidence.transportErrorName==='TimeoutError'||Boolean(evidence.transportCode?.includes('TIMEOUT'))||evidence.transportCode==='ETIMEDOUT';
}
function httpFailure(status:number,code?:string):ProviderFailureKind{
 if(code==='OUT_OF_USAGE_CREDITS')return 'QUOTA_EXHAUSTED';
 if(['MISSING_KEY','INVALID_KEY','DEACTIVATED_KEY'].includes(code||'')||status===401||status===403)return 'AUTH';
 if(code==='EXCEEDED_FREQ_LIMIT'||status===429)return 'RATE_LIMITED';
 return 'HTTP';
}
async function boundedResponseText(response:Response,limit:number,diagnostic:ProviderRequestDiagnostic,aborted:Promise<never>){
 const reader=response.body?.getReader();
 if(!reader)return '';
 const chunks:Uint8Array[]=[];
 let bytes=0;
 try{
  for(;;){
   const chunk=await Promise.race([reader.read(),aborted]);
   if(chunk.done)break;
   bytes+=chunk.value.byteLength;diagnostic.responseBytes=bytes;
   if(bytes>limit)throw new RequestFailure('BODY_TOO_LARGE');
   chunks.push(chunk.value);
  }
  const joined=new Uint8Array(bytes);let offset=0;
  for(const chunk of chunks){joined.set(chunk,offset);offset+=chunk.length;}
  try{return new TextDecoder('utf-8',{fatal:true}).decode(joined);}
  catch{throw new RequestFailure('INVALID_JSON');}
 }catch(error){
  void reader.cancel().catch(()=>undefined);
  if(error instanceof RequestFailure)throw error;
  const evidence=transportEvidence(error);
  throw new RequestFailure(timeoutEvidence(evidence)?'TIMEOUT':'BODY_READ_FAILED',evidence);
 }finally{reader.releaseLock();}
}

async function jsonRequest<T>(options:Settings,url:string,deadline:number,
 stage:ProviderRequestDiagnostic['stage'],endpointCode:ProviderRequestDiagnostic['endpoint']):Promise<JsonResult<T>>{
 const started=Date.now(),diagnostic=requestDiagnostic(stage,endpointCode);
 const budget=Math.min(options.timeoutMs,deadline-started);
 const finish=(result:Omit<JsonResult<T>,'diagnostic'>):JsonResult<T>=>{
  diagnostic.elapsedMs=Math.max(0,Date.now()-started);
  return {...result,diagnostic};
 };
 if(budget<MIN_REQUEST_BUDGET_MS){
  diagnostic.failureKind='DEADLINE';diagnostic.failurePhase='BUDGET';
  return finish({ok:false,status:504,error:'The Odds API batch deadline reached; no request started'});
 }
 const controller=new AbortController();
 let onAbort:()=>void=()=>undefined;
 const aborted=new Promise<never>((_,reject)=>{
  onAbort=()=>reject(new RequestFailure('TIMEOUT'));
  controller.signal.addEventListener('abort',onAbort,{once:true});
 });
 const timer=setTimeout(()=>controller.abort(),budget);
 let response:Response;
 try{
  diagnostic.attempted=true;
  try{
   // Observe redirects without following them or moving credentials to another endpoint.
   response=await Promise.race([fetch(url,{headers:{Accept:'application/json','x-api-key':options.apiKey},cache:'no-store',redirect:'manual',signal:controller.signal}),aborted]);
  }catch(error){
   Object.assign(diagnostic,transportEvidence(error));
   const timedOut=controller.signal.aborted||error instanceof RequestFailure&&error.kind==='TIMEOUT'||timeoutEvidence(diagnostic);
   diagnostic.failureKind=timedOut?'TIMEOUT':'NETWORK';diagnostic.failurePhase='REQUEST';
   return finish({ok:false,status:timedOut?504:502,error:`The Odds API ${stage.toLowerCase()} ${timedOut?'timed out':'network request failed'} before an HTTP response`});
  }
  // Opaque/error responses expose status 0, which is not evidence of an HTTP status.
  if(!Number.isInteger(response.status)||response.status<100||response.status>599){
   diagnostic.failureKind=response.type==='opaqueredirect'?'REDIRECT_BLOCKED':'NETWORK';diagnostic.failurePhase='REQUEST';
   void response.body?.cancel().catch(()=>undefined);
   return finish({ok:false,status:502,error:`The Odds API ${stage.toLowerCase()} returned no observable HTTP status`});
  }
  diagnostic.responseReceived=true;diagnostic.httpStatus=response.status;diagnostic.observedAt=new Date().toISOString();
  const quota={remaining:headerNum(response,'x-requests-remaining'),used:headerNum(response,'x-requests-used'),last:headerNum(response,'x-requests-last')};
  diagnostic.quota=quota;
  if(response.status>=300&&response.status<400){
   diagnostic.failureKind='REDIRECT_BLOCKED';diagnostic.failurePhase='VALIDATION';
   void response.body?.cancel().catch(()=>undefined);
   return finish({ok:false,status:response.status,error:`The Odds API ${stage.toLowerCase()} returned HTTP ${response.status}; redirect was not followed`,...quota});
  }
  let body:string;
  try{body=await boundedResponseText(response,response.ok?MAX_SUCCESS_BODY_BYTES:MAX_ERROR_BODY_BYTES,diagnostic,aborted);}
  catch(error){
   const failure=error instanceof RequestFailure?error.kind:'BODY_READ_FAILED';
   diagnostic.bodyFailureKind=failure;diagnostic.failureKind=response.ok?failure:httpFailure(response.status);
   diagnostic.failurePhase='RESPONSE_BODY';Object.assign(diagnostic,error instanceof RequestFailure?error.evidence:transportEvidence(error));
   return finish({ok:false,status:response.ok?(failure==='TIMEOUT'?504:502):response.status,
    error:`The Odds API ${stage.toLowerCase()} received HTTP ${response.status}, but the response body failed (${failure})`,...quota});
  }
  let parsed:unknown;
  try{parsed=JSON.parse(body);}
  catch{
   diagnostic.bodyFailureKind='INVALID_JSON';diagnostic.failureKind=response.ok?'INVALID_JSON':httpFailure(response.status);
   diagnostic.failurePhase='RESPONSE_BODY';
   return finish({ok:false,status:response.ok?502:response.status,error:`The Odds API ${stage.toLowerCase()} received HTTP ${response.status} with invalid JSON`,...quota});
  }
  if(!response.ok){
   const record=parsed&&typeof parsed==='object'&&!Array.isArray(parsed)?parsed as Record<string,unknown>:{};
   const candidate=record.error_code;
   // Never copy arbitrary error text, request URLs, response bodies or credentials into diagnostics.
   if(typeof candidate==='string'&&PROVIDER_ERROR_CODES.has(candidate))diagnostic.providerErrorCode=candidate;
   diagnostic.failureKind=httpFailure(response.status,diagnostic.providerErrorCode);diagnostic.failurePhase='VALIDATION';
   return finish({ok:false,status:response.status,
    error:`The Odds API ${stage.toLowerCase()} received HTTP ${response.status}${diagnostic.providerErrorCode?' ('+diagnostic.providerErrorCode+')':''}`,...quota});
  }
  if(!Array.isArray(parsed)){
   diagnostic.failureKind='INVALID_PAYLOAD';diagnostic.failurePhase='VALIDATION';
   return finish({ok:false,status:502,error:`The Odds API ${stage.toLowerCase()} received HTTP ${response.status} with an invalid ${endpointCode==='SPORTS_CATALOG'?'sports catalog':'odds array'}`,...quota});
  }
  return finish({ok:true,status:response.status,data:parsed as T,...quota});
 }finally{
  clearTimeout(timer);controller.signal.removeEventListener('abort',onAbort);
 }
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

function boardDiagnostics(requests:ProviderRequestDiagnostic[],quota:Quota,failureKind?:ProviderFailureKind):ProviderDiagnostics{
 const quotaObservedAt=quota.remaining===undefined?undefined:[...requests].reverse().find(x=>x.responseReceived&&x.quota.remaining!==undefined)?.observedAt;
 return {schemaVersion:1,requests,failureKind,cacheHit:false,cacheAgeMs:0,
  quotaEvidence:quotaObservedAt?'CURRENT_RESPONSE':'UNAVAILABLE',...(quotaObservedAt?{quotaObservedAt}:{})};
}

type BudgetBlock={error:string;status:number;kind:ProviderFailureKind};
async function loadBoard(options:Settings,deadline:number):Promise<TheOddsApiResult>{
 const warnings:string[]=[],attempts:TheOddsApiAttempt[]=[],requests:ProviderRequestDiagnostic[]=[];
 let quota:Quota={};
 const fail=(error:string,status=503,retryAfterMs=options.failureCacheMs,failureKind?:ProviderFailureKind):TheOddsApiResult=>({
  ok:false,data:[],attempts,warnings,discoveredSports:0,sportsWithEvents:0,fetchedSports:attempts.length,
  quota,error,status,retryAfterMs,diagnostics:boardDiagnostics(requests,quota,failureKind||requests.at(-1)?.failureKind)
 });
 const updateQuota=(result:Quota)=>{quota={remaining:result.remaining,used:result.used,last:result.last};};
 const guard=(cost:number):BudgetBlock|null=>{
  if(deadline-Date.now()<MIN_REQUEST_BUDGET_MS)return {error:'The Odds API batch deadline reached; no further paid request started',status:504,kind:'DEADLINE'};
  if(quota.remaining===undefined)return {error:'THE_ODDS_API_QUOTA_UNVERIFIED: no paid request permitted without a valid remaining-credit header',status:503,kind:'QUOTA_UNVERIFIED'};
  if(quota.remaining-cost<options.reserve)return {error:`THE_ODDS_API_CREDIT_RESERVE: ${quota.remaining} remaining cannot cover estimated cost ${cost} and preserve ${options.reserve} reserved credits`,status:503,kind:'CREDIT_RESERVE'};
  if(options.preflightOnly)return {error:'THE_ODDS_API_CREDIT_PAUSED: production release is in preflight-only mode',status:503,kind:'CREDIT_PAUSED'};
  return null;
 };
 const blockedRequest=(stage:ProviderRequestDiagnostic['stage'],endpointCode:ProviderRequestDiagnostic['endpoint'],block:BudgetBlock)=>{
  const diagnostic=requestDiagnostic(stage,endpointCode);
  diagnostic.failureKind=block.kind;diagnostic.failurePhase='BUDGET';requests.push(diagnostic);
  return {ok:false,status:block.status,error:block.error,diagnostic,blocked:true} as JsonResult<unknown[]> & {blocked:boolean};
 };
 const paid=async(stage:ProviderRequestDiagnostic['stage'],sportKey:string,path:string,params:Record<string,string>)=>{
  const cost=estimateOddsRequestCost(params),blocked=guard(cost),endpointCode=stage==='EXPANSION'?'SPORT_ODDS':'UPCOMING_ODDS';
  if(blocked)return blockedRequest(stage,endpointCode,blocked);
  const result=await jsonRequest<unknown[]>(options,endpoint(options,path,params),deadline,stage,endpointCode);
  requests.push(result.diagnostic);updateQuota(result);
  if(result.ok&&result.remaining===undefined){result.diagnostic.failureKind='QUOTA_UNVERIFIED';result.diagnostic.failurePhase='VALIDATION';}
  const data=Array.isArray(result.data)?result.data:[];
  if(result.diagnostic.attempted)attempts.push({sportKey,events:data.length,oddsEvents:data.length,ok:result.ok,status:result.status,
   error:result.error,cost:result.last,estimatedCost:cost,remaining:result.remaining});
  return {...result,blocked:!result.diagnostic.attempted};
 };

 // /sports is quota-free and returns the same quota headers. Never bootstrap paid odds first.
 const catalog=await jsonRequest<ActiveSport[]>(options,endpoint(options,'/sports/'),deadline,'PREFLIGHT','SPORTS_CATALOG');
 requests.push(catalog.diagnostic);updateQuota(catalog);
 if(!catalog.ok||!Array.isArray(catalog.data))return fail(catalog.error||'The Odds API quota preflight returned an invalid sports catalog',catalog.ok?502:catalog.status||502,
  catalog.status===429?300000:options.failureCacheMs);
 if(quota.remaining===undefined){
  catalog.diagnostic.failureKind='QUOTA_UNVERIFIED';catalog.diagnostic.failurePhase='VALIDATION';
  return fail('THE_ODDS_API_QUOTA_UNVERIFIED: free catalog did not provide a valid remaining-credit header; no paid request made',503,Math.max(options.cacheMs,options.failureCacheMs));
 }
 const activeSports=catalog.data.filter(x=>x&&typeof x==='object'&&typeof x.key==='string'&&x.key.trim()&&x.active!==false&&!x.has_outrights);
 const params={regions:options.regions,bookmakers:options.bookmakers,markets:options.markets,oddsFormat:'american',dateFormat:'iso'};
 let bootstrap=await paid('BOOTSTRAP','upcoming','/sports/upcoming/odds',params);
 let bootstrapData=Array.isArray(bootstrap.data)?bootstrap.data:[];

 if(!bootstrap.blocked&&((!bootstrap.ok&&(bootstrap.status===400||bootstrap.status===422))||(bootstrap.ok&&bootstrapData.length===0))){
  warnings.push('Primary upcoming-odds bootstrap was rejected or empty; considering the provider-safe US h2h baseline within the remaining budget');
  const fallback=await paid('FALLBACK','upcoming-us-h2h','/sports/upcoming/odds',{regions:'us',markets:'h2h',oddsFormat:'american',dateFormat:'iso'});
  bootstrap=fallback;bootstrapData=Array.isArray(fallback.data)?fallback.data:[];
  if(fallback.ok&&bootstrapData.length)warnings.push(`Provider-safe bootstrap recovered ${bootstrapData.length} live event(s)`);
 }
 if(!bootstrap.ok||bootstrapData.length===0){
  const cooldown=bootstrap.blocked?Math.max(options.cacheMs,options.failureCacheMs):bootstrap.status===429?300000:options.failureCacheMs;
  return fail(bootstrap.error||'No live sportsbook odds returned',bootstrap.status||502,cooldown,bootstrap.diagnostic.failureKind||'NO_MARKETS');
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
  if(blocked){blockedRequest('EXPANSION','SPORT_ODDS',blocked);warnings.push(blocked.error);break;}
  // Preserve serialized pacing, but do not start work that outlives the panel's deadline.
  if(deadline-Date.now()<650+MIN_REQUEST_BUDGET_MS){
   const error='The Odds API batch deadline prevents further sport expansion';
   blockedRequest('EXPANSION','SPORT_ODDS',{error,status:504,kind:'DEADLINE'});warnings.push(error);break;
  }
  await sleep(650);
  const result=await paid('EXPANSION',sportKey,`/sports/${encodeURIComponent(sportKey)}/odds`,expansionParams);
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
  error:data.length?undefined:'No live sportsbook odds returned',
  diagnostics:boardDiagnostics(requests,quota,data.length?requests.at(-1)?.failureKind:'NO_MARKETS')};
}

function cachedResult(cache:Cached,options:Settings,cacheHit=false):TheOddsApiResult{
 const ageMs=Math.max(0,Date.now()-cache.at);
 const stale=cache.value.ok&&ageMs>options.maxAgeMin*60000;
 return {...cache.value,snapshotAt:new Date(cache.at).toISOString(),cacheAgeMs:ageMs,
  diagnostics:{...cache.value.diagnostics,cacheHit,cacheAgeMs:ageMs,
   quotaEvidence:cache.value.diagnostics.quotaEvidence==='UNAVAILABLE'?'UNAVAILABLE':cacheHit?'CACHED_RESPONSE':'CURRENT_RESPONSE',
   ...(stale?{failureKind:'CACHE_STALE'}:{})},
  ...(stale?{ok:false,status:503,error:`THE_ODDS_API_CACHE_STALE: stored response is ${(ageMs/60000).toFixed(1)}m old; original quote timestamps are preserved and the configured paid refresh cadence has not been accelerated`,
   retryAfterMs:Math.max(0,cache.at+cache.ttlMs-Date.now())}:{}),
  ...(!cache.value.ok?{retryAfterMs:Math.max(0,cache.at+cache.ttlMs-Date.now())}:{})};
}

export async function fetchTheOddsApiBoard(config:ProviderConfig):Promise<TheOddsApiResult>{
 const options=settings(config);
 const configurationFailure=(error:string):TheOddsApiResult=>({
  ok:false,data:[],attempts:[],warnings:[],discoveredSports:0,sportsWithEvents:0,fetchedSports:0,quota:{},status:503,error,
  diagnostics:boardDiagnostics([],{},'CONFIGURATION')
 });
 try{
  const url=new URL(options.baseUrl);
  if(!['https:','http:'].includes(url.protocol)||url.username||url.password) return configurationFailure('THE_ODDS_API_BASE_URL is not valid');
 }catch{return configurationFailure('THE_ODDS_API_BASE_URL is not valid');}
 if(!options.apiKey||options.apiKey==='[SENSITIVE]'||/[\s\u0000-\u001f\u007f]/.test(options.apiKey))return configurationFailure('THE_ODDS_API_KEY is not configured or valid');
 const account=digest([options.baseUrl,options.apiKey]);
 const scope=digest([config.id,options]);
 const stored=caches.get(scope);
 if(stored&&Date.now()-stored.at>=0&&Date.now()-stored.at<stored.ttlMs)return cachedResult(stored,options,true);
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
