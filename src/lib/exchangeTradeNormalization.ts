/**
 * Read-only normalization of exchange trade prints into Monte's historical
 * touch-replay format. Provider adapters must supply explicit evidence.
 */
import type {MarketTradePrint} from './marketLimitTouchReplay';
export type ExchangeTradeRow={
 timestamp:string;
 price:string|number;
 size:string|number;
};
export type ExchangeTradeBatch={
 exchange:'kalshi'|'polymarket';
 marketId:string;
 fetchedAt:string;
 sourceUrl:string;
 /** Provider must affirm all historical pages were retrieved. */
 paginationComplete:boolean;
 /** Provider must affirm requested game window was covered. */
 windowComplete:boolean;
 trades:ExchangeTradeRow[];
};
export type NormalizedExchangeTrades={
 status:'invalid'|'incomplete'|'ok';
 exchange:ExchangeTradeBatch['exchange'];
 marketId:string;
 prints:MarketTradePrint[];
 warning:string;
};
export function normalizeExchangeTrades(batch:ExchangeTradeBatch):NormalizedExchangeTrades{
 const warning='Historical trade prints only. These do not establish limit-order queue position, executable liquidity, or actual fills.';
 const empty=(status:NormalizedExchangeTrades['status']):NormalizedExchangeTrades=>({status,exchange:batch.exchange,marketId:batch.marketId,prints:[],warning});
 if(!['kalshi','polymarket'].includes(batch.exchange)||!batch.marketId||
 !batch.sourceUrl.startsWith('https://')||!Number.isFinite(Date.parse(batch.fetchedAt))||
 !Array.isArray(batch.trades))return empty('invalid');
 if(batch.paginationComplete!==true||batch.windowComplete!==true)return empty('incomplete');
 const prints:MarketTradePrint[]=[];
 for(const trade of batch.trades){
  const price=typeof trade.price==='number'?trade.price:Number(trade.price);
  const size=typeof trade.size==='number'?trade.size:Number(trade.size);
  if(!Number.isFinite(Date.parse(trade.timestamp))||!Number.isFinite(price)||price<0||price>1||
   !Number.isFinite(size)||size<=0)return empty('invalid');
  prints.push({timestamp:trade.timestamp,price,size});
 }
 return {status:'ok',exchange:batch.exchange,marketId:batch.marketId,
  prints:prints.sort((a,b)=>Date.parse(a.timestamp)-Date.parse(b.timestamp)),warning};
}
