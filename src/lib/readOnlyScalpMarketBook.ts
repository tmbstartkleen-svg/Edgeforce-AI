/**
 * Read-only quote normalization boundary for scalping research.
 * No HTTP requests, credentials, order submission, or assumed settlement equivalence.
 */
export type RawMarketLevel={price:unknown;quantity:unknown};
export type RawMarketBook={
 venue:'kalshi'|'polymarket_us';marketId:string;outcomeId:string;
 observedAt:string;sourceUrl:string;currency:'USD';
 bids:RawMarketLevel[];asks:RawMarketLevel[];
 marketOpen:boolean;settlementVerified:boolean;
};
export type NormalizedMarketBook={
 venue:'kalshi'|'polymarket_us';marketId:string;outcomeId:string;
 observedAt:string;sourceUrl:string;bestBid:number;bestAsk:number;
 bidDepth:number;askDepth:number;ageMs:number;
 status:'verified_read_only'|'blocked';reasons:string[];
};
export function normalizeReadOnlyMarketBook(
 raw:RawMarketBook,nowMs:number,maxAgeMs=30000
):NormalizedMarketBook{
 const reasons:string[]=[];
 if(!raw||!['kalshi','polymarket_us'].includes(raw.venue)||!raw.marketId||!raw.outcomeId)
  reasons.push('invalid_market_identity');
 const safe=raw??({} as RawMarketBook);
 if(safe.currency!=='USD'||typeof safe.sourceUrl!=='string'||!/^https:\/\//.test(safe.sourceUrl))
  reasons.push('invalid_source_provenance');
 const ageMs=nowMs-Date.parse(safe.observedAt);
 if(!Number.isFinite(ageMs)||ageMs<0||!Number.isFinite(maxAgeMs)||maxAgeMs<=0||ageMs>maxAgeMs)
  reasons.push('stale_market_data');
 if(!safe.marketOpen)reasons.push('market_closed');
 if(!safe.settlementVerified)reasons.push('unverified_settlement');
 const parse=(levels:RawMarketLevel[])=>(Array.isArray(levels)?levels:[]).map(level=>({
  price:typeof level?.price==='number'?level.price:NaN,
  quantity:typeof level?.quantity==='number'?level.quantity:NaN
 }));
 const bids=parse(safe.bids),asks=parse(safe.asks);
 if(!bids.length||!asks.length||[...bids,...asks].some(l=>
  !Number.isFinite(l.price)||l.price<=0||l.price>=1||
  !Number.isSafeInteger(l.quantity)||l.quantity<=0))reasons.push('invalid_or_empty_order_book');
 const bestBid=bids.length?Math.max(...bids.map(l=>l.price)):NaN;
 const bestAsk=asks.length?Math.min(...asks.map(l=>l.price)):NaN;
 if(!Number.isFinite(bestBid)||!Number.isFinite(bestAsk)||bestBid>bestAsk)
  reasons.push('crossed_or_missing_market');
 const bidDepth=bids.filter(l=>l.price===bestBid).reduce((n,l)=>n+l.quantity,0);
 const askDepth=asks.filter(l=>l.price===bestAsk).reduce((n,l)=>n+l.quantity,0);
 if(!Number.isSafeInteger(bidDepth)||!Number.isSafeInteger(askDepth))reasons.push('invalid_depth');
 return {venue:safe.venue,marketId:safe.marketId,outcomeId:safe.outcomeId,
  observedAt:safe.observedAt,sourceUrl:safe.sourceUrl,bestBid,bestAsk,bidDepth,askDepth,ageMs,
  status:reasons.length?'blocked':'verified_read_only',reasons};
}
