import type {ExchangeTradePage,ExchangeTradePageAssembly} from './exchangeTradePageAssembly';
import {assembleExchangeTradePages} from './exchangeTradePageAssembly';
import {fetchHistoricalTradePages} from './historicalTradeFetcher';

/**
 * Read-only Kalshi public trade-history adapter.
 * Prices are in cents, converted to 0..1 YES dollars.
 * Both taker sides may execute a YES/NO binary contract; yes_price is the
 * contract's YES-equivalent transaction price, not a taker-side indicator.
 * A successful fetch does not certify complete game-window coverage.
 */
export async function fetchKalshiYesTradeHistory(
 ticker:string,
 maxPages=20,
 fetcher:typeof fetch=fetch
):Promise<ExchangeTradePageAssembly>{
 const invalid:ExchangeTradePageAssembly={status:'invalid',batch:null,warning:'Invalid Kalshi ticker'};
 if(!/^[A-Z0-9-]{2,160}$/.test(ticker))return invalid;
 const origin='https://api.elections.kalshi.com';
 const api='/trade-api/v2/markets/trades';
 const fetched=await fetchHistoricalTradePages({
  exchange:'kalshi',marketId:ticker,baseUrl:origin,approvedHostname:'api.elections.kalshi.com',maxPages,
  buildUrl:(cursor)=>{
   const url=new URL(api,origin);
   url.searchParams.set('ticker',ticker);
   url.searchParams.set('limit','1000');
   if(cursor)url.searchParams.set('cursor',cursor);
   return url.toString();
  },
  parsePage:(body:unknown,cursor:string|null):ExchangeTradePage=>{
   if(!body||typeof body!=='object')throw Error('invalid payload');
   const raw=body as Record<string,unknown>;
   if(!Array.isArray(raw.trades))throw Error('missing trades');
   const trades=raw.trades.map((item:unknown)=>{
    if(!item||typeof item!=='object')throw Error('invalid trade');
    const t=item as Record<string,unknown>;
    if(t.ticker!==ticker||!['yes','no'].includes(String(t.taker_side)))throw Error('trade side or ticker mismatch');
    if(typeof t.yes_price!=='number'||typeof t.count!=='number'||typeof t.created_time!=='string')throw Error('unsupported trade schema');
    return {timestamp:t.created_time,price:t.yes_price/100,size:t.count};
   });
   return {exchange:'kalshi',marketId:ticker,
    sourceUrl:(()=>{const url=new URL(api,origin);url.searchParams.set('ticker',ticker);url.searchParams.set('limit','1000');if(cursor)url.searchParams.set('cursor',cursor);return url.toString();})(),
    fetchedAt:new Date().toISOString(),requestCursor:cursor,
    nextCursor:typeof raw.cursor==='string'&&raw.cursor.length>0?raw.cursor:null,trades};
  }
 },fetcher);
 if(fetched.status!=='ok')return {status:fetched.status,batch:null,warning:fetched.warning};
 return assembleExchangeTradePages(fetched.pages,false);
}
