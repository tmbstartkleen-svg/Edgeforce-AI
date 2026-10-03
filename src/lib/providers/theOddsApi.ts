import type {ProviderConfig} from './types';

type SportRow={key:string;group?:string;title?:string;active?:boolean;has_outrights?:boolean};
type EventRow={id:string;commence_time?:string};

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
 error?:string;
};

const base=()=>String(process.env.THE_ODDS_API_BASE_URL||'https://api.the-odds-api.com/v4').replace(/\/$/,'');
let cache:{at:number;value:TheOddsApiResult}|null=null;
const failureCacheMs=()=>Math.max(5000,int(process.env.THE_ODDS_API_FAILURE_CACHE_MS,30000));
const int=(v:string|undefined,fallback:number)=>{const n=Number(v);return Number.isFinite(n)?Math.floor(n):fallback};
const csv=(v:string|undefined)=>String(v||'').split(',').map(x=>x.trim()).filter(Boolean);
const priority=(key:string)=>{
 const order=[
  'americanfootball_nfl','americanfootball_ncaaf','baseball_mlb','basketball_nba','basketball_ncaab',
  'basketball_wnba','icehockey_nhl','mma_mixed_martial_arts','soccer_usa_mls'
 ];
 const exact=order.indexOf(key);
 if(exact>=0)return exact;
 if(key.startsWith('tennis_'))return 20;
 if(key.startsWith('soccer_'))return 30;
 if(key.startsWith('basketball_'))return 40;
 if(key.startsWith('icehockey_'))return 50;
 if(key.startsWith('baseball_'))return 60;
 return 100;
};
const headerNum=(res:Response,name:string)=>{
 const n=Number(res.headers.get(name));
 return Number.isFinite(n)?n:undefined;
};

async function jsonRequest<T>(url:string,timeoutMs=10000):Promise<{ok:boolean;status:number;data?:T;error?:string;remaining?:number;used?:number;last?:number}>{
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{
  const res=await fetch(url,{headers:{Accept:'application/json'},cache:'no-store',signal:controller.signal});
  const quota={remaining:headerNum(res,'x-requests-remaining'),used:headerNum(res,'x-requests-used'),last:headerNum(res,'x-requests-last')};
  if(!res.ok)return {ok:false,status:res.status,error:`HTTP ${res.status}`,...quota};
  return {ok:true,status:res.status,data:await res.json() as T,...quota};
 }catch(error){
  return {ok:false,status:0,error:error instanceof Error?error.message:'request failed'};
 }finally{clearTimeout(timer)}
}

function withKey(path:string,key:string,params:Record<string,string>={}){
 const url=new URL(base()+path);
 url.searchParams.set('apiKey',key);
 for(const [k,v] of Object.entries(params))if(v)url.searchParams.set(k,v);
 return url.toString();
}

async function mapBatches<T,R>(items:T[],size:number,fn:(item:T)=>Promise<R>,pauseMs=0){
 const out:R[]=[];
 for(let i=0;i<items.length;i+=size){
  out.push(...await Promise.all(items.slice(i,i+size).map(fn)));
  if(pauseMs>0&&i+size<items.length)await new Promise(resolve=>setTimeout(resolve,pauseMs));
 }
 return out;
}

export async function fetchTheOddsApiBoard(config:ProviderConfig):Promise<TheOddsApiResult>{
 const cacheMs=Math.max(15000,int(process.env.THE_ODDS_API_CACHE_MS,120000));
 if(cache){
  const ttl=cache.value.ok?cacheMs:failureCacheMs();
  if(Date.now()-cache.at<ttl)return cache.value;
 }
 const key=config.apiKey||process.env.THE_ODDS_API_KEY;
 if(!key)return {ok:false,data:[],attempts:[],warnings:[],discoveredSports:0,sportsWithEvents:0,fetchedSports:0,quota:{},error:'THE_ODDS_API_KEY is not configured'};

 const timeoutMs=Math.max(3000,int(process.env.THE_ODDS_API_TIMEOUT_MS,10000));
 const lookaheadDays=Math.max(1,Math.min(8,int(process.env.THE_ODDS_API_LOOKAHEAD_DAYS,8)));
 const maxSports=Math.max(1,Math.min(100,int(process.env.THE_ODDS_API_MAX_SPORTS,50)));
 const reserve=Math.max(0,int(process.env.THE_ODDS_API_CREDIT_RESERVE,25));
 const markets=process.env.THE_ODDS_API_MARKETS||'h2h,spreads,totals';
 const bookmakers=process.env.THE_ODDS_API_BOOKMAKERS||'draftkings,fanduel,betmgm,williamhill_us';
 const regions=process.env.THE_ODDS_API_REGIONS||'us';
 const requested=csv(process.env.THE_ODDS_API_SPORT_KEYS);
 const now=new Date();
 const to=new Date(now.getTime()+lookaheadDays*86400000).toISOString();

 const sportsResponse=await jsonRequest<SportRow[]>(withKey('/sports/',key),timeoutMs);
 if(!sportsResponse.ok||!Array.isArray(sportsResponse.data)){
  const value:TheOddsApiResult={
   ok:false,data:[],attempts:[],warnings:[],discoveredSports:0,sportsWithEvents:0,fetchedSports:0,
   quota:{remaining:sportsResponse.remaining,used:sportsResponse.used,last:sportsResponse.last},
   error:sportsResponse.error||'sports discovery failed'
  };
  cache={at:Date.now(),value};
  return value;
 }
 const allSports=sportsResponse.data.filter(x=>x.active!==false&&!x.has_outrights);
 const sports=(requested.length?allSports.filter(x=>requested.includes(x.key)):allSports)
  .sort((a,b)=>priority(a.key)-priority(b.key)||a.key.localeCompare(b.key));

 const eventChecks=await mapBatches(sports,4,async sport=>{
  const result=await jsonRequest<EventRow[]>(withKey(`/sports/${encodeURIComponent(sport.key)}/events`,key,{dateFormat:'iso',commenceTimeFrom:now.toISOString(),commenceTimeTo:to}),timeoutMs);
  const events=Array.isArray(result.data)?result.data.filter(x=>{
   const t=x.commence_time?new Date(x.commence_time).getTime():0;
   return t>=now.getTime()&&t<=new Date(to).getTime();
  }):[];
  return {sport,result,events};
 },200);
 const candidates=eventChecks.filter(x=>x.result.ok&&x.events.length>0).map(x=>x.sport).slice(0,maxSports);
 const warnings:string[]=[];
 if(eventChecks.some(x=>!x.result.ok))warnings.push(`${eventChecks.filter(x=>!x.result.ok).length} free event-discovery request(s) failed`);
 if(candidates.length<eventChecks.filter(x=>x.result.ok&&x.events.length>0).length)warnings.push(`Sport scan capped at ${maxSports}; set THE_ODDS_API_MAX_SPORTS higher to expand coverage`);

 const data:unknown[]=[];
 const attempts:TheOddsApiAttempt[]=[];
 let remaining=sportsResponse.remaining;
 let used=sportsResponse.used;
 let last=sportsResponse.last;
 let stoppedForQuota=false;

 for(let i=0;i<candidates.length;i+=3){
  if(remaining!==undefined&&remaining<=reserve){stoppedForQuota=true;break}
  const batch=candidates.slice(i,i+3);
  const rows=await Promise.all(batch.map(async sport=>{
   const url=withKey(`/sports/${encodeURIComponent(sport.key)}/odds`,key,{
    regions,bookmakers,markets,oddsFormat:'american',dateFormat:'iso',commenceTimeFrom:now.toISOString(),commenceTimeTo:to
   });
   const result=await jsonRequest<unknown[]>(url,timeoutMs);
   const events=Array.isArray(result.data)?result.data:[];
   return {sport,result,events};
  }));
  for(const row of rows){
   if(row.result.remaining!==undefined)remaining=row.result.remaining;
   if(row.result.used!==undefined)used=row.result.used;
   if(row.result.last!==undefined)last=row.result.last;
   if(row.result.ok)data.push(...row.events);
   attempts.push({
    sportKey:row.sport.key,
    events:eventChecks.find(x=>x.sport.key===row.sport.key)?.events.length||0,
    oddsEvents:row.events.length,
    ok:row.result.ok,status:row.result.status,error:row.result.error,
    cost:row.result.last,remaining:row.result.remaining
   });
  }
 }
 if(stoppedForQuota)warnings.push(`Stopped live odds refresh with ${remaining} credits remaining to preserve the configured reserve of ${reserve}`);
 if(!data.length)warnings.push('The Odds API returned no DraftKings events for the selected sports/window');

 const rateLimited=attempts.some(x=>x.status===429);
 const quotaStopped=stoppedForQuota&&remaining!==undefined;
 const error=data.length
  ?undefined
  :rateLimited
   ?`The Odds API rate limited the live refresh (HTTP 429)`
   :quotaStopped
    ?`The Odds API credit reserve stopped the refresh with ${remaining} credits remaining`
    :'No live sportsbook odds returned';
 const value:TheOddsApiResult={
  ok:data.length>0,
  data,
  attempts,
  warnings,
  discoveredSports:allSports.length,
  sportsWithEvents:eventChecks.filter(x=>x.result.ok&&x.events.length>0).length,
  fetchedSports:attempts.length,
  quota:{remaining,used,last},
  error
 };
 cache={at:Date.now(),value};
 return value;
}
