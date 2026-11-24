import {ingestKalshiYesBook,type KalshiReadOnlyContext} from './kalshiPublicOrderBookAdapter';
import type {ExchangeBookResult} from './readOnlyExchangeBookIngestion';

/** Research-only public Kalshi order-book client. No credentials or order writes.
 * Caller must independently verify settlement rules and market-open state.
 * Supports the documented integer-cent price ladder; rejects other formats.
 */
export async function fetchKalshiPublicYesBook(
 ticker:string,context:KalshiReadOnlyContext,nowMs:number,
 fetcher:typeof fetch,maxAgeMs=30000
):Promise<ExchangeBookResult>{
 const blocked=(reason:string):ExchangeBookResult=>({status:'blocked',book:null,reasons:[reason]});
 if(!/^[A-Za-z0-9_-]{1,120}$/.test(ticker)||context.marketId!==ticker)
  return blocked('invalid_or_mismatched_ticker');
 if(typeof fetcher!=='function'||!Number.isFinite(nowMs))return blocked('invalid_transport_or_time');
 const endpoint='https://api.elections.kalshi.com/trade-api/v2/markets/'+encodeURIComponent(ticker)+'/orderbook';
 try{
  const response=await fetcher(endpoint,{method:'GET',headers:{Accept:'application/json'},
   signal:AbortSignal.timeout(8000),redirect:'error',cache:'no-store'});
  if(!response.ok)return blocked('kalshi_http_'+response.status);
  const body=await response.text();
  if(body.length>500000)return blocked('oversized_kalshi_response');
  const json=JSON.parse(body) as {orderbook?:{yes?:unknown;no?:unknown}};
  if(!json||typeof json!=='object'||!json.orderbook)return blocked('missing_kalshi_orderbook');
  const convert=(levels:unknown):unknown=>{
   if(!Array.isArray(levels))return null;
   return levels.map(x=>Array.isArray(x)&&x.length===2&&Number.isSafeInteger(x[0])&&x[0]>0&&x[0]<100?
    [x[0]/100,x[1]]:null);
  };
  return ingestKalshiYesBook({yes:convert(json.orderbook.yes),no:convert(json.orderbook.no)},
   {...context,sourceUrl:endpoint,observedAt:new Date(nowMs).toISOString()},nowMs,maxAgeMs);
 }catch{return blocked('kalshi_transport_or_parse_failure');}
}
