/**
 * EdgeForce research-only scalp planner. Does not send exchange requests.
 * Every proposed sell must be backed by a confirmed owned position.
 */
export type ScalpSide='yes'|'no';
export type ScalpVenue='kalshi'|'polymarket_us';
export type ScalpInput={
 venue:ScalpVenue;marketId:string;side:ScalpSide;
 fairProbability:number;bestBid:number;bestAsk:number;
 buyLimit:number;ownedContracts:number;openSellContracts:number;
 confirmedBuyFillContracts:number;buyFeePerContract:number;sellFeePerContract:number;
 minimumNetProfitPerContract:number;minimumEntryEdge:number;
 maxSpread:number;marketDataAgeMs:number;maxDataAgeMs:number;
 marketOpen:boolean;tradingHalted:boolean;modelValidated:boolean;
 allowNewOrders:boolean;
};
export type ScalpPlan={
 status:'blocked'|'research_only';
 reasons:string[];
 entryLimit:number|null;
 exitLimit:number|null;
 sellQuantity:number;
 expectedNetPerContract:number|null;
};
export function planScalp(input:ScalpInput):ScalpPlan{
 const reasons:string[]=[];
 const blocked=():ScalpPlan=>({status:'blocked',reasons,entryLimit:null,exitLimit:null,sellQuantity:0,expectedNetPerContract:null});
 if(!input.marketId||!['kalshi','polymarket_us'].includes(input.venue)||!['yes','no'].includes(input.side))reasons.push('invalid_market');
 const prices=[input.fairProbability,input.bestBid,input.bestAsk,input.buyLimit];
 if(prices.some(v=>!Number.isFinite(v)||v<=0||v>=1)||input.bestBid>input.bestAsk)reasons.push('invalid_prices');
 const costs=[input.buyFeePerContract,input.sellFeePerContract,input.minimumNetProfitPerContract,input.minimumEntryEdge,input.maxSpread];
 if(costs.some(v=>!Number.isFinite(v)||v<0))reasons.push('invalid_costs');
 if(![input.ownedContracts,input.openSellContracts,input.confirmedBuyFillContracts].every(v=>Number.isSafeInteger(v)&&v>=0)||
  input.openSellContracts>input.ownedContracts)reasons.push('invalid_inventory');
 if(!Number.isFinite(input.marketDataAgeMs)||input.marketDataAgeMs<0||
 !Number.isFinite(input.maxDataAgeMs)||input.maxDataAgeMs<=0||input.marketDataAgeMs>input.maxDataAgeMs)reasons.push('stale_market_data');
 if(!input.marketOpen||input.tradingHalted)reasons.push('market_unavailable');
 if(!input.modelValidated)reasons.push('uncalibrated_model');
 if(!input.allowNewOrders)reasons.push('execution_disabled');
 if(reasons.length)return blocked();
 const spread=input.bestAsk-input.bestBid;
 if(spread>input.maxSpread)reasons.push('spread_too_wide');
 const edge=input.fairProbability-input.buyLimit-input.buyFeePerContract;
 if(edge<input.minimumEntryEdge)reasons.push('insufficient_entry_edge');
 const sellQuantity=Math.min(Math.max(0,input.ownedContracts-input.openSellContracts),input.confirmedBuyFillContracts);
 const minimumExit=input.buyLimit+input.buyFeePerContract+input.sellFeePerContract+input.minimumNetProfitPerContract;
 const exitLimit=Math.ceil(minimumExit*10000)/10000;
 if(exitLimit>=1)reasons.push('unreachable_exit');
 if(reasons.length)return blocked();
 return {status:'research_only',reasons,entryLimit:input.buyLimit,
  exitLimit,sellQuantity,expectedNetPerContract:exitLimit-input.buyLimit-input.buyFeePerContract-input.sellFeePerContract};
}
