import {advancePaperScalp,type PaperScalpCycle} from './paperAutomatedScalpCycle';
import type {PaperBook} from './paperScalpOrderEngine';
import type {NormalizedMarketBook} from './readOnlyScalpMarketBook';
import {rankSingleMarketScalps,type ScalpRankSettings} from './crossVenuePaperScalpRanking';

/**
 * Research-only bridge: validated market quote -> ranked candidate ->
 * paper limit order. Never sends network requests or real orders.
 * Caller persists returned state and reconciles confirmed paper fills.
 */
export type PaperScalpDispatch={
 status:'blocked'|'waiting'|'paper_order_created';
 reason:string;book:PaperBook;cycle:PaperScalpCycle;
 orderId:string|null;selectedMarket:string|null;
};
export function dispatchPaperScalpFromQuotes(
 books:NormalizedMarketBook[],settings:ScalpRankSettings,
 book:PaperBook,cycle:PaperScalpCycle,nowMs:number
):PaperScalpDispatch{
 const blocked=(reason:string):PaperScalpDispatch=>({
  status:'blocked',reason,book,cycle,orderId:null,selectedMarket:null
 });
 if(!Number.isFinite(nowMs)||!cycle||!cycle.enabled||cycle.killSwitch)
  return blocked('disabled_or_invalid_cycle');
 const matching=books.filter(x=>x.marketId===cycle.marketId);
 if(!matching.length)return blocked('no_market_quote');
 const identities=new Set(matching.map(x=>JSON.stringify([x.venue,x.outcomeId])));
 if(identities.size!==1)return blocked('ambiguous_market_identity');
 const ranked=rankSingleMarketScalps(matching,settings);
 const candidate=ranked.find(x=>x.status==='indicative_spread');
 if(!candidate)return blocked('no_valid_indicative_spread');
 const quote=matching.find(x=>x.venue===candidate.venue&&x.outcomeId===candidate.outcomeId);
 if(!quote||quote.status!=='verified_read_only')return blocked('unverified_market_quote');
 const result=advancePaperScalp(book,{
  ...cycle,maxBuyPrice:Math.min(cycle.maxBuyPrice,candidate.entryLimit)
 },{
  bestBid:quote.bestBid,bestAsk:quote.bestAsk,ageMs:quote.ageMs,
  marketOpen:quote.status==='verified_read_only'
 });
 return {status:result.status,reason:result.reason,book:result.book,cycle:result.cycle,
  orderId:result.order?.id??null,selectedMarket:candidate.marketId};
}
