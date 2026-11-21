import {normalizeExchangeTrades,type ExchangeTradeBatch,type ExchangeTradeRow} from './exchangeTradeNormalization';

/** Combines independently fetched historical trade pages, without claiming completeness. */
export type ExchangeTradePage={
 exchange:'kalshi'|'polymarket';
 marketId:string;
 sourceUrl:string;
 fetchedAt:string;
 /** Null only when the provider explicitly signals the final page. */
 nextCursor:string|null;
 trades:ExchangeTradeRow[];
};
export type ExchangeTradePageAssembly={
 status:'invalid'|'incomplete'|'ok';
 batch:ExchangeTradeBatch|null;
 warning:string;
};
export function assembleExchangeTradePages(
 pages:ExchangeTradePage[],
 windowComplete:boolean
):ExchangeTradePageAssembly{
 const warning='Read-only historical page assembly. A terminal cursor alone does not prove the entire game window is covered.';
 const fail=(status:ExchangeTradePageAssembly['status']):ExchangeTradePageAssembly=>({status,batch:null,warning});
 if(!Array.isArray(pages)||pages.length===0)return fail('incomplete');
 const first=pages[0];
 if(!first||!['kalshi','polymarket'].includes(first.exchange)||!first.marketId||
 !first.sourceUrl.startsWith('https://'))return fail('invalid');
 const all:ExchangeTradeRow[]=[];
 const seen=new Set<string>();
 for(let i=0;i<pages.length;i++){
  const p=pages[i];
  if(p.exchange!==first.exchange||p.marketId!==first.marketId||
   !p.sourceUrl.startsWith('https://')||!Number.isFinite(Date.parse(p.fetchedAt))||
   !Array.isArray(p.trades)||typeof p.nextCursor!=='string'&&p.nextCursor!==null)return fail('invalid');
  if(i<pages.length-1&&(!p.nextCursor||seen.has(p.nextCursor)))return fail('invalid');
  if(p.nextCursor)seen.add(p.nextCursor);
  all.push(...p.trades);
 }
 if(pages[pages.length-1].nextCursor!==null||windowComplete!==true)return fail('incomplete');
 const batch:ExchangeTradeBatch={exchange:first.exchange,marketId:first.marketId,
  sourceUrl:first.sourceUrl,fetchedAt:pages[pages.length-1].fetchedAt,
  paginationComplete:true,windowComplete:true,trades:all};
 const normalized=normalizeExchangeTrades(batch);
 if(normalized.status!=='ok')return fail(normalized.status);
 return {status:'ok',batch,warning};
}
