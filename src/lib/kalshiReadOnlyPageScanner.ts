import {discoverKalshiPublicMarkets,type KalshiDiscoveredMarket} from './kalshiPublicMarketDiscovery';
import {fetchKalshiPublicYesBook} from './kalshiPublicReadOnlyClient';
import type {NormalizedMarketBook} from './readOnlyScalpMarketBook';

/** Bounded read-only Kalshi discovery + order-book scan.
 * Never infers verified settlement from a title. No trades or credentials.
 */
export type KalshiScanResult={
 status:'completed'|'blocked';scanned:number;markets:KalshiDiscoveredMarket[];
 books:NormalizedMarketBook[];blockedMarkets:{ticker:string;reasons:string[]}[];
 reason:string|null;
};
export async function scanKalshiPublicPage(
 fetcher:typeof fetch,nowMs:number,
 options:{limit:number;maxBooks:number;maxQuoteAgeMs:number;verifiedTickers:ReadonlySet<string>}
):Promise<KalshiScanResult>{
 const empty=(reason:string):KalshiScanResult=>({status:'blocked',scanned:0,markets:[],books:[],blockedMarkets:[],reason});
 if(!Number.isFinite(nowMs)||!options||!Number.isSafeInteger(options.limit)||options.limit<1||options.limit>200||
 !Number.isSafeInteger(options.maxBooks)||options.maxBooks<1||options.maxBooks>25||
 !Number.isFinite(options.maxQuoteAgeMs)||options.maxQuoteAgeMs<=0||
 !(options.verifiedTickers instanceof Set))return empty('invalid_scan_configuration');
 const discovery=await discoverKalshiPublicMarkets(fetcher,options.limit);
 if(discovery.status!=='ready')return empty(discovery.reason??'market_discovery_failed');
 const markets=discovery.markets.slice(0,options.maxBooks);
 const books:NormalizedMarketBook[]=[];
 const blockedMarkets:{ticker:string;reasons:string[]}[]=[];
 for(const market of markets){
  const verified=options.verifiedTickers.has(market.ticker);
  if(!verified){blockedMarkets.push({ticker:market.ticker,reasons:['settlement_review_required']});continue;}
  const result=await fetchKalshiPublicYesBook(market.ticker,{
   marketId:market.ticker,outcomeId:'yes',observedAt:new Date(nowMs).toISOString(),
   sourceUrl:'https://api.elections.kalshi.com',marketOpen:true,settlementVerified:verified
  },nowMs,fetcher,options.maxQuoteAgeMs);
  if(result.status==='ready'&&result.book)books.push(result.book);
  else blockedMarkets.push({ticker:market.ticker,reasons:result.reasons});
 }
 return {status:'completed',scanned:markets.length,markets,books,blockedMarkets,reason:null};
}
