/**
 * Kalshi public market discovery boundary. No credentials, trading or background
 * scheduling. Caller supplies transport and independently reviews market rules.
 */
export type KalshiDiscoveredMarket={ticker:string;title:string;status:string;closeTime:string|null};
export type KalshiDiscoveryResult={status:'ready'|'blocked';markets:KalshiDiscoveredMarket[];nextCursor:string|null;reason:string|null};
export async function discoverKalshiPublicMarkets(
 fetcher:typeof fetch,limit=100,cursor?:string
):Promise<KalshiDiscoveryResult>{
 const blocked=(reason:string):KalshiDiscoveryResult=>({status:'blocked',markets:[],nextCursor:null,reason});
 if(typeof fetcher!=='function'||!Number.isSafeInteger(limit)||limit<1||limit>200||
  (cursor!==undefined&&(!/^[A-Za-z0-9_=-]{1,300}$/.test(cursor))))
  return blocked('invalid_discovery_arguments');
 const url=new URL('https://api.elections.kalshi.com/trade-api/v2/markets');
 url.searchParams.set('limit',String(limit));url.searchParams.set('status','open');
 if(cursor)url.searchParams.set('cursor',cursor);
 try{
  const response=await fetcher(url.toString(),{method:'GET',headers:{Accept:'application/json'},
   signal:AbortSignal.timeout(8000),redirect:'error',cache:'no-store'});
  if(!response.ok)return blocked('kalshi_http_'+response.status);
  const text=await response.text();
  if(text.length>1000000)return blocked('oversized_discovery_response');
  const body=JSON.parse(text) as {markets?:unknown;cursor?:unknown};
  if(!Array.isArray(body?.markets)||body.markets.length>limit)return blocked('invalid_market_list');
  const markets:KalshiDiscoveredMarket[]=[];
  for(const raw of body.markets){
   if(!raw||typeof raw!=='object')return blocked('malformed_market');
   const m=raw as Record<string,unknown>;
   if(typeof m.ticker!=='string'||!/^[A-Za-z0-9_-]{1,120}$/.test(m.ticker)||
    typeof m.title!=='string'||typeof m.status!=='string'||m.status!=='active'&&m.status!=='open')
    return blocked('invalid_market_fields');
   markets.push({ticker:m.ticker,title:m.title.slice(0,300),status:m.status,
    closeTime:typeof m.close_time==='string'?m.close_time:null});
  }
  if(body.cursor!==undefined&&body.cursor!==null&&
   (typeof body.cursor!=='string'||(body.cursor.length>0&&!/^[A-Za-z0-9_=-]{1,300}$/.test(body.cursor))))
   return blocked('invalid_next_cursor');
  return {status:'ready',markets,nextCursor:typeof body.cursor==='string'&&body.cursor?body.cursor:null,reason:null};
 }catch{return blocked('discovery_transport_or_parse_failure');}
}
