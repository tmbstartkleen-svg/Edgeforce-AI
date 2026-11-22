import {applyPaperEvent,type PaperBook,type PaperOrder} from './paperScalpOrderEngine';

/**
 * Single-market paper scalper. All transitions require confirmed paper fills.
 * Never calls exchanges, never submits real orders, never assumes a quote touch
 * implies a fill. Caller must persist book + cycle across invocations.
 */
export type PaperScalpCycle={
 marketId:string;enabled:boolean;killSwitch:boolean;maxPosition:number;
 maxBuyPrice:number;targetNetPerContract:number;buyFeePerContract:number;
 sellFeePerContract:number;nextOrderSequence:number;
};
export type PaperScalpAction={status:'blocked'|'waiting'|'paper_order_created';reason:string;book:PaperBook;cycle:PaperScalpCycle;order:PaperOrder|null};
export function advancePaperScalp(
 book:PaperBook,cycle:PaperScalpCycle,
 quote:{bestBid:number;bestAsk:number;ageMs:number;marketOpen:boolean},
 maxQuoteAgeMs=30000
):PaperScalpAction{
 const done=(status:PaperScalpAction['status'],reason:string,order:PaperOrder|null=null,updated=book):PaperScalpAction=>({status,reason,book:updated,cycle,order});
 if(!cycle.enabled||cycle.killSwitch)return done('blocked','execution_disabled_or_kill_switch');
 if(!cycle.marketId||!Number.isSafeInteger(cycle.maxPosition)||cycle.maxPosition<=0||
  !Number.isSafeInteger(cycle.nextOrderSequence)||cycle.nextOrderSequence<0||
  ![cycle.maxBuyPrice,cycle.targetNetPerContract,cycle.buyFeePerContract,cycle.sellFeePerContract]
   .every(n=>Number.isFinite(n)&&n>=0)||cycle.maxBuyPrice<=0||cycle.maxBuyPrice>=1)
  return done('blocked','invalid_risk_settings');
 if(!quote.marketOpen||!Number.isFinite(quote.ageMs)||quote.ageMs<0||quote.ageMs>maxQuoteAgeMs||
  !Number.isFinite(quote.bestBid)||!Number.isFinite(quote.bestAsk)||
  quote.bestBid<=0||quote.bestAsk>=1||quote.bestBid>quote.bestAsk)return done('blocked','invalid_or_stale_market');
 if(!book||!Array.isArray(book.orders)||!Array.isArray(book.fills)||
  !Number.isSafeInteger(book.owned)||book.owned<0||!Number.isFinite(book.cashFlow))
  return done('blocked','invalid_paper_book');
 const active=book.orders.filter(o=>o.status==='open'||o.status==='partially_filled');
 if(active.some(o=>o.side==='buy'))return done('waiting','awaiting_confirmed_buy_fill');
 const openSell=active.filter(o=>o.side==='sell').reduce((n,o)=>n+o.quantity-o.filled,0);
 if(openSell>book.owned)return done('blocked','oversubscribed_inventory');
 const available=book.owned-openSell;
 if(available>0){
  // Sell only if there is a single identifiable acquisition cost basis.
  const buys=book.fills.filter(f=>book.orders.some(o=>o.id===f.orderId&&o.side==='buy'));
  const sold=book.fills.filter(f=>book.orders.some(o=>o.id===f.orderId&&o.side==='sell')).reduce((n,f)=>n+f.quantity,0);
  const bought=buys.reduce((n,f)=>n+f.quantity,0);
  if(bought-sold!==book.owned||bought===0)return done('blocked','unverified_inventory_cost_basis');
  // Weighted average basis is conservative only if all inventory is homogeneous;
  // use the highest paid fill to prevent selling any acquired unit below target.
  const highestCost=Math.max(...buys.map(f=>f.price));
  const exit=Math.ceil((highestCost+cycle.buyFeePerContract+cycle.sellFeePerContract+cycle.targetNetPerContract)*10000)/10000;
  if(exit>=1)return done('blocked','unreachable_profitable_exit');
  const order:PaperOrder={id:cycle.marketId+'-paper-sell-'+cycle.nextOrderSequence,side:'sell',limitPrice:exit,quantity:available,filled:0,status:'open'};
  const transition=applyPaperEvent(book,{type:'place',order});
  if(!transition.accepted)return done('blocked',transition.reason??'paper_sell_rejected');
  return {status:'paper_order_created',reason:'sell_after_confirmed_fill',order,book:transition.book,cycle:{...cycle,nextOrderSequence:cycle.nextOrderSequence+1}};
 }
 if(book.owned>=cycle.maxPosition)return done('waiting','position_limit_reached');
 if(active.some(o=>o.side==='sell'))return done('waiting','awaiting_confirmed_sell_fill');
 const quantity=cycle.maxPosition-book.owned;
 const price=Math.min(cycle.maxBuyPrice,quote.bestBid);
 if(price<=0||price>=1)return done('blocked','invalid_entry_limit');
 const order:PaperOrder={id:cycle.marketId+'-paper-buy-'+cycle.nextOrderSequence,side:'buy',limitPrice:price,quantity,filled:0,status:'open'};
 const transition=applyPaperEvent(book,{type:'place',order});
 if(!transition.accepted)return done('blocked',transition.reason??'paper_buy_rejected');
 return {status:'paper_order_created',reason:'paper_limit_buy',order,book:transition.book,cycle:{...cycle,nextOrderSequence:cycle.nextOrderSequence+1}};
}
