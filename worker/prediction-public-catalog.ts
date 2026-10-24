/** Bounded public prediction-market catalog. Discovery is NOT an executable arbitrage signal.
 * Public reads only. No user credentials, trades, or direct private order book access.
 */
type CatalogItem={exchange:'Kalshi'|'Polymarket';id:string;title:string;url:string;closesAt:string|null;yesBidCents:number|null;yesAskCents:number|null;priceQuality:'INDICATIVE_ONLY'|'NOT_AVAILABLE';marketType:'BINARY'|'UNVERIFIED';};
type Env={CRON_SECRET?:unknown;PREDICTION_CATALOG_ENABLED?:unknown};
const hdr={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
const reply=(v:unknown,status=200)=>Response.json(v,{status,headers:hdr});
const str=(x:unknown,max=220)=>typeof x==='string'?x.trim().slice(0,max):'';
const cents=(x:unknown)=>{const n=Number(x);return x===null||x===undefined||x===''||!Number.isFinite(n)||n<0||n>1?null:Math.round(n*10000)/100};
const kalshiCents=(x:unknown)=>{const n=Number(x);return x===null||x===undefined||x===''||!Number.isFinite(n)||n<0||n>100?null:n};
const date=(x:unknown)=>typeof x==='string'&&Number.isFinite(Date.parse(x))?new Date(x).toISOString():null;
function jsonArray(x:unknown):unknown[]{if(Array.isArray(x))return x;if(typeof x==='string')try{const v=JSON.parse(x);return Array.isArray(v)?v:[]}catch{}return [];}
export function normalizeKalshiCatalog(raw:unknown):CatalogItem[]{
 const rows=raw&&typeof raw==='object'&&!Array.isArray(raw)&&(raw as {markets?:unknown}).markets;
 if(!Array.isArray(rows))return[];
 return rows.slice(0,100).flatMap((m:unknown)=>{
  if(!m||typeof m!=='object')return[];const v=m as Record<string,unknown>;
  const id=str(v.ticker,140),title=str(v.title);if(!id||!title)return[];
  // Kalshi market quote fields are *indicative*, not authenticated order-book asks.
  return [{exchange:'Kalshi' as const,id,title,url:'https://kalshi.com/markets/'+encodeURIComponent(id),
   closesAt:date(v.close_time),yesBidCents:kalshiCents(v.yes_bid),yesAskCents:kalshiCents(v.yes_ask),
   priceQuality:'INDICATIVE_ONLY' as const,marketType:'BINARY' as const}];
 });
}
export function normalizePolymarketCatalog(raw:unknown):CatalogItem[]{
 if(!Array.isArray(raw))return[];
 return raw.slice(0,100).flatMap((m:unknown)=>{
  if(!m||typeof m!=='object')return[];const v=m as Record<string,unknown>;
  const id=str(v.conditionId||v.id,140),title=str(v.question);if(!id||!title)return[];
  const outcomes=jsonArray(v.outcomes).map(x=>str(x,30).toLowerCase());
  if(outcomes.length!==2||!outcomes.includes('yes')||!outcomes.includes('no'))return[];
  const slug=str(v.slug,150);
  return [{exchange:'Polymarket' as const,id,title,url:'https://polymarket.com/event/'+encodeURIComponent(slug||id),
   closesAt:date(v.endDate),yesBidCents:cents(v.bestBid),yesAskCents:cents(v.bestAsk),
   priceQuality:'INDICATIVE_ONLY' as const,marketType:'BINARY' as const}];
 });
}
async function boundedFetch(url:string):Promise<unknown>{
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),4500);
 try{
  const response=await fetch(url,{headers:{Accept:'application/json'},redirect:'error',signal:controller.signal});
  if(!response.ok)throw Error('REMOTE_NOT_OK');
  const length=Number(response.headers.get('content-length')||0);if(length>1500000)throw Error('RESPONSE_TOO_LARGE');
  const body=await response.text();if(body.length>1500000)throw Error('RESPONSE_TOO_LARGE');
  return JSON.parse(body);
 }finally{clearTimeout(timer)}
}
export async function predictionCatalogGateway(request:Request,env:Env):Promise<Response>{
 if(request.method!=='GET')return new Response(null,{status:405,headers:{...hdr,Allow:'GET'}});
 if(typeof env.CRON_SECRET!=='string'||env.CRON_SECRET.length<24)return reply({ok:false,error:'AUTH_NOT_CONFIGURED'},503);
 if(request.headers.get('authorization')!=='Bearer '+env.CRON_SECRET)return reply({ok:false,error:'UNAUTHORIZED'},401);
 if(env.PREDICTION_CATALOG_ENABLED!=='true')return reply({ok:false,error:'CATALOG_POLLING_DISABLED',creditsSpent:0},503);
 const now=Date.now();const cutoff=new Date(now).toISOString();
 const oneYearTs=Math.floor((now+365*86400000)/1000);
 const requests=[
  boundedFetch('https://api.elections.kalshi.com/trade-api/v2/markets?status=open&limit=100&min_close_ts='+Math.floor(now/1000)),
  boundedFetch('https://api.elections.kalshi.com/trade-api/v2/markets?status=open&limit=100&min_close_ts='+oneYearTs),
  boundedFetch('https://gamma-api.polymarket.com/markets?closed=false&active=true&limit=100&order=endDate&ascending=true'),
  boundedFetch('https://gamma-api.polymarket.com/markets?closed=false&active=true&limit=100&order=endDate&ascending=false')
 ];
 const settled=await Promise.allSettled(requests);
 const collected=[
  ...(settled[0].status==='fulfilled'?normalizeKalshiCatalog(settled[0].value):[]),
  ...(settled[1].status==='fulfilled'?normalizeKalshiCatalog(settled[1].value):[]),
  ...(settled[2].status==='fulfilled'?normalizePolymarketCatalog(settled[2].value):[]),
  ...(settled[3].status==='fulfilled'?normalizePolymarketCatalog(settled[3].value):[])
 ];
 const byIdentity=new Map<string,CatalogItem>();
 for(const item of collected)if(!byIdentity.has(item.exchange+'|'+item.id))byIdentity.set(item.exchange+'|'+item.id,item);
 const markets=[...byIdentity.values()].filter(x=>!x.closesAt||x.closesAt>cutoff);
 const end=new Date(now+10*365.25*86400000);
 const longDated=markets.filter(x=>x.closesAt&&Date.parse(x.closesAt)>now+365*86400000);
 return reply({ok:true,mode:'PUBLIC_CATALOG_DISCOVERY_ONLY',asOf:new Date().toISOString(),
   markets:markets.slice(0,400),count:markets.length,longDatedCount:longDated.length,
   requestedExchanges:['Kalshi','Polymarket'],
   upstreamStatus:{Kalshi:settled.slice(0,2).some(r=>r.status==='fulfilled')?'RESPONSE_RECEIVED':'UNAVAILABLE',
    Polymarket:settled.slice(2,4).some(r=>r.status==='fulfilled')?'RESPONSE_RECEIVED':'UNAVAILABLE'},
   requestedMaxHorizonYears:10,horizonEndsAt:end.toISOString(),sampleLimitPerExchange:200,
   exhaustiveCatalog:false,contractEquivalenceVerified:false,orderbookDepthVerified:false,
   executionPricesVerified:false,feeScheduleVerified:false,
   arbitrageOpportunities:[],signalsGenerated:0,ordersPlaced:0,creditsSpent:0,
   notes:['Market titles and quotes are discovery-only. They are not executable asks or settlement-equivalent contracts.',
    'This is a bounded near-term plus long-horizon sample of public open markets; it is not full exchange coverage.',
    'Long-dated contract closing dates and settlement dates can differ; funds may be locked longer.']});
}
