import {evaluatePulseEvidence} from '../pulseEvidence';

export type FanDuelPulsePrice={
 selectionId:string;
 american:number|null;
};

export type FanDuelPulseRow={
 sport:string;
 fixture:string;
 market:string;
 status:string;
 inplay:boolean;
 updatedAt?:string;
 prices:FanDuelPulsePrice[];
};

export type FanDuelOddsPulse={
 ok:boolean;
 source:'fanlinewire';
 mode:'keyless-public-snapshot';
 generatedAt:string|null;
 sequence:number|null;
 liveTotal:number;
 prematchTotal:number;
 rows:FanDuelPulseRow[];
 drops:unknown[];
 latencyMs:number;
 fresh:boolean;
 ageMs:number|null;
 warning?:string;
};

let cache:{at:number;value:FanDuelOddsPulse}|null=null;
let inFlight:Promise<FanDuelOddsPulse>|null=null;
let lastAttemptAt:number|null=null;
const minimumRequestIntervalMs=10000;
const cacheMs=()=>Math.max(10000,Number(process.env.FANLINEWIRE_CACHE_MS||10000));
const staleFallbackMs=()=>Math.max(cacheMs(),Number(process.env.FANLINEWIRE_STALE_FALLBACK_MS||120000));
const timeoutMs=()=>Math.max(1500,Number(process.env.FANLINEWIRE_TIMEOUT_MS||4000));

const obj=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const arr=(v:unknown)=>Array.isArray(v)?v:[];
const str=(v:unknown)=>typeof v==='string'?v:'';
const bool=(v:unknown)=>v===true;
const num=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?v:null;
const selectionId=(v:unknown)=>typeof v==='string'?v.trim():typeof v==='number'&&Number.isSafeInteger(v)&&v>=0?String(v):'';
const currentSnapshot=(value:FanDuelOddsPulse):FanDuelOddsPulse=>{
 const evidence=evaluatePulseEvidence(value);
 return {...value,fresh:evidence.fresh,ageMs:evidence.ageMs,
  warning:value.warning||(!evidence.fresh?'FanDuel pulse source time is stale or unverified':undefined)};
};

export async function fetchFanDuelOddsPulse(force=false):Promise<FanDuelOddsPulse>{
 // A forced refresh can skip the configured cache, never an in-flight request or minimum interval.
 if(inFlight)return inFlight;
 if(cache&&((lastAttemptAt!==null&&Date.now()-lastAttemptAt<minimumRequestIntervalMs)||
  (!force&&Date.now()-cache.at<cacheMs())))return currentSnapshot(cache.value);
 const request=(async()=>{
 const started=Date.now();
 lastAttemptAt=started;
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),timeoutMs());
 try{
  const res=await fetch('https://fanlinewire.com/odds.json',{
   cache:'no-store',
   signal:controller.signal,
   headers:{Accept:'application/json','User-Agent':'Edgeforce-AI/114 FanDuel pulse'}
  });
  if(!res.ok)throw new Error('HTTP '+res.status);
  const root=obj(await res.json());
  const generatedAt=str(root.generated_at)||null;
  const generatedMs=generatedAt?new Date(generatedAt).getTime():Number.NaN;
  const ageMs=Number.isFinite(generatedMs)&&generatedMs<=Date.now()?Date.now()-generatedMs:null;
  const live=obj(root.live),prematch=obj(root.prematch);
  const rows:FanDuelPulseRow[]=arr(root.fixtures).map(raw=>{
   const row=obj(raw);
   return {
    sport:str(row.sport)||'Unknown',
    fixture:str(row.fixture)||str(row.game)||'Unknown',
    market:str(row.market),
    status:str(row.status)||'UNKNOWN',
    inplay:bool(row.inplay),
    updatedAt:str(row.updated_at)||undefined,
    prices:arr(row.prices).map(p=>{
     const price=obj(p);
     return {selectionId:selectionId(price.selection_id??price.selectionId),american:num(price.american)};
    }).filter(x=>x.selectionId)
   };
  }).filter(x=>x.fixture!=='Unknown');
  const value:FanDuelOddsPulse={
   ok:true,
   source:'fanlinewire',
   mode:'keyless-public-snapshot',
   generatedAt,
   sequence:num(root.sequence),
   liveTotal:Number(live.total||0),
   prematchTotal:Number(prematch.total||0),
   rows,
   drops:arr(root.drops),
   latencyMs:Date.now()-started,
   fresh:ageMs!==null&&ageMs<=120000,
   ageMs,
   warning:ageMs!==null&&ageMs>120000?'FanDuel pulse snapshot is older than two minutes':undefined
  };
  const checked=currentSnapshot(value);
  cache={at:Date.now(),value:checked};
  return checked;
 }catch(error){
  if(cache&&Date.now()-cache.at<=staleFallbackMs()){
   const fallback=currentSnapshot({...cache.value,fresh:false,warning:`FanDuel pulse network refresh failed; serving last snapshot: ${error instanceof Error?error.message:'request failed'}`});
   cache={...cache,value:fallback};
   return fallback;
  }
  const value:FanDuelOddsPulse={
   ok:false,source:'fanlinewire',mode:'keyless-public-snapshot',generatedAt:null,sequence:null,
   liveTotal:0,prematchTotal:0,rows:[],drops:[],latencyMs:Date.now()-started,fresh:false,ageMs:null,
   warning:error instanceof Error?error.message:'FanDuel pulse request failed'
  };
  cache={at:Date.now(),value};
  return value;
 }finally{clearTimeout(timer)}
 })();
 inFlight=request;
 try{return await request}
 finally{if(inFlight===request)inFlight=null}
}
