import type {ExchangeTradePage} from './exchangeTradePageAssembly';

/**
 * Provider-agnostic, read-only paginated history retrieval.
 * Caller supplies a vetted same-origin URL builder and parser; no credentials
 * or trading endpoints are accepted by this module.
 */
export type HistoricalTradeFetcher={
 exchange:'kalshi'|'polymarket';
 marketId:string;
 baseUrl:string;
 /** Exact provider-approved hostname; required to prevent arbitrary network access. */
 approvedHostname:string;
 maxPages:number;
 buildUrl:(cursor:string|null)=>string;
 parsePage:(body:unknown,cursor:string|null)=>ExchangeTradePage;
};
export type HistoricalTradeFetchResult={
 status:'invalid'|'incomplete'|'ok';
 pages:ExchangeTradePage[];
 warning:string;
};
export async function fetchHistoricalTradePages(
 config:HistoricalTradeFetcher,
 fetcher:typeof fetch=fetch
):Promise<HistoricalTradeFetchResult>{
 const warning='Historical trades only. API pagination completion does not prove full time-window coverage or actual order fills.';
 const pages:ExchangeTradePage[]=[];
 const result=(status:HistoricalTradeFetchResult['status']):HistoricalTradeFetchResult=>({status,pages,warning});
 let origin:URL;
 try{origin=new URL(config.baseUrl);}catch{return result('invalid');}
 if(origin.protocol!=='https:'||origin.username||origin.password||
  !config.approvedHostname||origin.hostname!==config.approvedHostname||
  !config.marketId||!['kalshi','polymarket'].includes(config.exchange)||
  !Number.isInteger(config.maxPages)||config.maxPages<1||config.maxPages>100||
  typeof config.buildUrl!=='function'||typeof config.parsePage!=='function')return result('invalid');
 const seen=new Set<string>();
 let cursor:string|null=null;
 for(let i=0;i<config.maxPages;i++){
  let url:URL;
  try{url=new URL(config.buildUrl(cursor));}catch{return result('invalid');}
  if(url.origin!==origin.origin||url.hostname!==config.approvedHostname||
   url.protocol!=='https:'||url.username||url.password)return result('invalid');
  let response:Response;
  try{response=await fetcher(url.toString(),{method:'GET',redirect:'error',headers:{accept:'application/json'}});}
  catch{return result('incomplete');}
  if(!response.ok)return result('incomplete');
  let body:unknown;
  try{body=await response.json();}catch{return result('invalid');}
  let page:ExchangeTradePage;
  try{page=config.parsePage(body,cursor);}catch{return result('invalid');}
  if(page.exchange!==config.exchange||page.marketId!==config.marketId||
    page.requestCursor!==cursor||!Array.isArray(page.trades)||
    typeof page.sourceUrl!=='string'||page.sourceUrl!==url.toString()||
    !Number.isFinite(Date.parse(page.fetchedAt))||
    (page.nextCursor!==null&&typeof page.nextCursor!=='string')||
    page.trades.some(t=>!Number.isFinite(Date.parse(t.timestamp))||
      !Number.isFinite(Number(t.price))||Number(t.price)<0||Number(t.price)>1||
      !Number.isFinite(Number(t.size))||Number(t.size)<=0))return result('invalid');
  pages.push(page);
  if(page.nextCursor===null)return result('ok');
  if(!page.nextCursor||seen.has(page.nextCursor))return result('invalid');
  seen.add(page.nextCursor);
  cursor=page.nextCursor;
 }
 return result('incomplete');
}
