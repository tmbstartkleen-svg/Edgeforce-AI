type KalshiMarket={
 ticker?:string;
 event_ticker?:string;
 title?:string;
 subtitle?:string;
 yes_sub_title?:string;
 no_sub_title?:string;
 yes_bid_dollars?:string|number;
 yes_ask_dollars?:string|number;
 last_price_dollars?:string|number;
 volume_fp?:string|number;
 volume_24h_fp?:string|number;
 open_interest_fp?:string|number;
 close_time?:string;
 expected_expiration_time?:string;
 status?:string;
};

type KalshiMarketsResponse={
 markets?:KalshiMarket[];
 cursor?:string;
};

const base=()=>String(process.env.KALSHI_API_BASE_URL||'https://external-api.kalshi.com/trade-api/v2').replace(/\/$/,'');
// Per-isolate cooldown prevents repeated rejected requests within one Worker instance.
// It is advisory across isolates; a shared distributed quota manager can complement it.
let cooldownUntil=0;
let lastFailureKind='';
const failureKind=(status:number)=>status===429?'rate_limited':status===401||status===403?'unauthorized':status===400||status===404?'bad_request':status>=500?'upstream_unavailable':'http_error';
const retryDelay=(header:string|null,now:number)=>{
 if(!header)return 60000;
 const seconds=Number(header);
 const time=Number.isFinite(seconds)?now+seconds*1000:Date.parse(header);
 return Number.isFinite(time)?Math.max(1000,Math.min(300000,time-now)):60000;
};
const clamp=(n:number)=>Math.max(.001,Math.min(.999,n));
const numberValue=(value:unknown)=>{
 const n=Number(value);
 return Number.isFinite(n)?n:undefined;
};

function marketProbability(row:KalshiMarket){
 const bid=numberValue(row.yes_bid_dollars);
 const ask=numberValue(row.yes_ask_dollars);
 const last=numberValue(row.last_price_dollars);
 if(bid!==undefined&&ask!==undefined&&bid>0&&ask>0)return clamp((bid+ask)/2);
 if(last!==undefined&&last>0)return clamp(last);
 if(bid!==undefined&&bid>0)return clamp(bid);
 if(ask!==undefined&&ask>0)return clamp(ask);
 return undefined;
}

function contractTitle(row:KalshiMarket,index:number){
 const parts=[row.title,row.subtitle,row.yes_sub_title]
  .map(x=>String(x||'').trim())
  .filter(Boolean);
 const unique=[...new Set(parts)];
 return unique.join(' — ')||`Kalshi ${index+1}`;
}

async function getPage(cursor?:string){
 if(Date.now()<cooldownUntil)return {ok:false as const,rows:[] as KalshiMarket[],cursor:'',error:'Kalshi provider cooldown active',errorKind:lastFailureKind||'cooldown',retryAfterMs:cooldownUntil-Date.now()};
 const url=new URL(base()+'/markets');
 url.searchParams.set('status','open');
 const pageLimit=Math.max(50,Math.min(1000,Number(process.env.KALSHI_MARKET_PAGE_LIMIT||1000)));
 url.searchParams.set('limit',String(pageLimit));
 url.searchParams.set('mve_filter','exclude');
 if(cursor)url.searchParams.set('cursor',cursor);

 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),Math.max(3000,Number(process.env.KALSHI_TIMEOUT_MS||8000)));
 try{
  const res=await fetch(url,{headers:{Accept:'application/json'},cache:'no-store',signal:controller.signal});
  if(!res.ok){
   const kind=failureKind(res.status);
   lastFailureKind=kind;
   if(res.status===429||res.status===400||res.status===404||res.status===401||res.status===403||res.status>=500){
    const delay=res.status===429?retryDelay(res.headers.get('retry-after'),Date.now()):res.status>=500?30000:res.status===400||res.status===404?60000:300000;
    cooldownUntil=Date.now()+delay;
   }
   return {ok:false as const,rows:[] as KalshiMarket[],cursor:'',error:`Kalshi ${kind} (HTTP ${res.status})`,errorKind:kind,retryAfterMs:Math.max(0,cooldownUntil-Date.now())};
  }
  cooldownUntil=0;
  lastFailureKind='';
  const payload=await res.json() as KalshiMarketsResponse;
  return {
   ok:true as const,
   rows:Array.isArray(payload.markets)?payload.markets:[],
   cursor:String(payload.cursor||''),
   error:undefined
  };
 }catch(error){
  const kind=controller.signal.aborted?'timeout':'network_error';
  lastFailureKind=kind;
  cooldownUntil=Date.now()+15000;
  return {
   ok:false as const,
   rows:[] as KalshiMarket[],
   cursor:'',
   error:error instanceof Error?error.message:'Kalshi request failed',
   errorKind:kind,
   retryAfterMs:15000
  };
 }finally{
  clearTimeout(timer);
 }
}

export async function fetchPublicKalshi(){
 if(process.env.KALSHI_ENABLED==='false'){
  return {ok:false,source:'Kalshi',contracts:[],error:'Kalshi public feed disabled'};
 }

 const maxPages=Math.max(1,Math.min(5,Number(process.env.KALSHI_MAX_PAGES||2)));
 const rows:KalshiMarket[]=[];
 let cursor='';
 let error:string|undefined;
 let errorKind:string|undefined;
 let retryAfterMs:number|undefined;

 for(let page=0;page<maxPages;page++){
  const result=await getPage(cursor||undefined);
  if(!result.ok){error=result.error;errorKind=result.errorKind;retryAfterMs=result.retryAfterMs;break}
  rows.push(...result.rows);
  if(!result.cursor||result.cursor===cursor)break;
  cursor=result.cursor;
 }

 const contracts=rows.map((row,index)=>{
  const yes=marketProbability(row);
  if(yes===undefined)return null;
  const bid=numberValue(row.yes_bid_dollars);
  const ask=numberValue(row.yes_ask_dollars);
  const volume=numberValue(row.volume_fp)??numberValue(row.volume_24h_fp);
  const liquidity=numberValue(row.open_interest_fp);
  return {
   id:String(row.ticker||`kalshi-${index}`),
   title:contractTitle(row,index),
   category:'Kalshi',
   yesProbability:yes,
   noProbability:1-yes,
   modelProbability:yes,
   probabilityDifference:0,
   volume,
   liquidity,
   bidProbability:bid!==undefined?clamp(bid):undefined,
   askProbability:ask!==undefined?clamp(ask):undefined,
   expiresAt:String(row.close_time||row.expected_expiration_time||'')||undefined,
   source:'Kalshi',
   venueType:'PREDICTION_EXCHANGE' as const
  };
 }).filter((x):x is NonNullable<typeof x>=>Boolean(x));

 return {
  ok:contracts.length>0,
  source:'Kalshi',
  contracts,
  error:contracts.length?undefined:(error||'No open Kalshi markets returned'),
  errorKind,
  retryAfterMs,
  partial:rows.length>0&&Boolean(error)
 };
}
