import type {ProviderConfig} from './types';

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


async function jsonRequestWith429Retry<T>(url:string,timeoutMs=10000){
 let result=await jsonRequest<T>(url,timeoutMs);
 if(result.status===429){
  await new Promise(resolve=>setTimeout(resolve,2500));
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

export async function fetchTheOddsApiBoard(config:ProviderConfig):Promise<TheOddsApiResult>{
 const cacheMs=Math.max(60000,int(process.env.THE_ODDS_API_CACHE_MS,600000));
 if(cache){
  const ttl=cache.value.ok?cacheMs:failureCacheMs();
  if(Date.now()-cache.at<ttl)return cache.value;
 }
 const key=config.apiKey||process.env.THE_ODDS_API_KEY;
 if(!key)return {ok:false,data:[],attempts:[],warnings:[],discoveredSports:0,sportsWithEvents:0,fetchedSports:0,quota:{},error:'THE_ODDS_API_KEY is not configured'};

 const timeoutMs=Math.max(3000,int(process.env.THE_ODDS_API_TIMEOUT_MS,10000));
 const markets=process.env.THE_ODDS_API_MARKETS||'h2h,spreads,totals';
 const bookmakers=process.env.THE_ODDS_API_BOOKMAKERS||'draftkings,fanduel,betmgm,williamhill_us';
 const regions=process.env.THE_ODDS_API_REGIONS||'us';
 const warnings:string[]=[];

 // Budget-safe bootstrap: one odds request returns the next 8 live/upcoming events
 // across all sports. This avoids fanning out across dozens of /events endpoints.
 const url=withKey('/sports/upcoming/odds',key,{
  regions,bookmakers,markets,oddsFormat:'american',dateFormat:'iso'
 });
 const result=await jsonRequestWith429Retry<unknown[]>(url,timeoutMs);
 const data=Array.isArray(result.data)?result.data:[];
 const attempts:TheOddsApiAttempt[]=[{
  sportKey:'upcoming',events:data.length,oddsEvents:data.length,ok:result.ok,
  status:result.status,error:result.error,cost:result.last,remaining:result.remaining
 }];

 if(result.status===429)warnings.push('The Odds API rate limited the budget-safe bootstrap request after one retry');
 if(result.ok&&!data.length)warnings.push('The Odds API returned no upcoming events with odds; empty responses do not consume quota');
 if(data.length)warnings.push('Budget-safe provider mode is active: next 8 live/upcoming events across all sports');

 const value:TheOddsApiResult={
  ok:result.ok&&data.length>0,
  data,
  attempts,
  warnings,
  discoveredSports:0,
  sportsWithEvents:data.length?1:0,
  fetchedSports:1,
  quota:{remaining:result.remaining,used:result.used,last:result.last},
  error:data.length?undefined:(result.error||'No live sportsbook odds returned')
 };
 cache={at:Date.now(),value};
 return value;
}
