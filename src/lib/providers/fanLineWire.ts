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
const cacheMs=()=>Math.max(10000,Number(process.env.FANLINEWIRE_CACHE_MS||10000));
const staleFallbackMs=()=>Math.max(cacheMs(),Number(process.env.FANLINEWIRE_STALE_FALLBACK_MS||120000));
const timeoutMs=()=>Math.max(1500,Number(process.env.FANLINEWIRE_TIMEOUT_MS||4000));

const obj=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const arr=(v:unknown)=>Array.isArray(v)?v:[];
const str=(v:unknown)=>typeof v==='string'?v:'';
const bool=(v:unknown)=>v===true;
const num=(v:unknown)=>{const n=Number(v);return Number.isFinite(n)?n:null};

export async function fetchFanDuelOddsPulse(force=false):Promise<FanDuelOddsPulse>{
 if(!force&&cache&&Date.now()-cache.at<cacheMs())return cache.value;
 if(!force&&inFlight)return inFlight;
 const request=(async()=>{
 const started=Date.now();
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),timeoutMs());
 try{
  const res=await fetch('https://fanlinewire.com/odds.json',{
   cache:'no-store',
   signal:controller.signal,
   headers:{Accept:'application/json','User-Agent':'Edgeforce-AI/116 FanDuel pulse'}
  });
  if(!res.ok)throw new Error('HTTP '+res.status);
  const root=obj(await res.json());
  const generatedAt=str(root.generated_at)||null;
  const generatedMs=generatedAt?new Date(generatedAt).getTime():Number.NaN;
  const ageMs=Number.isFinite(generatedMs)?Math.max(0,Date.now()-generatedMs):null;
  const live=obj(root.live),prematch=obj(root.prematch);
  const rows:FanDuelPulseRow[]=arr(root.fixtures).map(raw=>{
   const row=obj(raw);
   return {
    sport:str(row.sport)||'Unknown',
    fixture:str(row.fixture)||str(row.game)||'Unknown',
    market:str(row.market)||'Unknown',
    status:str(row.status)||'UNKNOWN',
    inplay:bool(row.inplay),
    updatedAt:str(row.updated_at)||undefined,
    prices:arr(row.prices).map(p=>{
     const price=obj(p);
     return {selectionId:String(price.selection_id||price.selectionId||''),american:num(price.american)};
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
  cache={at:Date.now(),value};
  return value;
 }catch(error){
  if(cache&&Date.now()-cache.at<=staleFallbackMs()){
   return {...cache.value,fresh:false,warning:`FanDuel pulse network refresh failed; serving last snapshot: ${error instanceof Error?error.message:'request failed'}`};
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
