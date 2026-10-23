/**
 * Stage 2 closing-line value audit for authenticated, settled snapshots.
 * Pure math: compares exactly equivalent outcomes at a single bookmaker.
 * Matching record labels alone cannot authenticate market data or ownership.
 */
export type ClosingLinePair={
 eventId:string;marketType:string;outcomeId:string;bookmaker:string;
 placedAmericanOdds:number;closingAmericanOdds:number;placedAt:string;closedAt:string;
 startsAt:string;sourceUpstreamId:string;closingUpstreamId:string;
 playerId?:string;line?:string;
};
const valid=(v:unknown)=>typeof v==='string'&&v.trim().length>0;
const decimal=(odds:number)=>odds>0?1+odds/100:1+100/(-odds);
const price=(odds:unknown)=>typeof odds==='number'&&Number.isSafeInteger(odds)&&Math.abs(odds)>=100;
export function auditClosingLineValue(pairs:ClosingLinePair[],now=Date.now()){
 if(!Array.isArray(pairs)||pairs.length>10000||!Number.isFinite(now))
  throw Error('INVALID_CLV_INPUT');
 const reasons:Record<string,number>={};
 const reject=(reason:string)=>{reasons[reason]=(reasons[reason]||0)+1};
 const seen=new Set<string>();
 const rows:Array<{eventId:string;marketType:string;outcomeId:string;bookmaker:string;
  closingLineValuePercent:number;closingImpliedProbability:number;
  placedImpliedProbability:number;beatClose:boolean;placedAmericanOdds:number;
  closingAmericanOdds:number}>= [];
 for(const q of pairs){
  if(!q||![q.eventId,q.marketType,q.outcomeId,q.bookmaker,q.sourceUpstreamId,q.closingUpstreamId].every(valid)||
   !price(q.placedAmericanOdds)||!price(q.closingAmericanOdds)){
   reject('INVALID_QUOTE_PAIR');continue;
  }
  if(q.marketType!=='h2h'&&!valid(q.line)){reject('MISSING_LINE');continue}
  if(q.marketType.startsWith('player_')&&(!valid(q.playerId)||q.playerId!.toLowerCase().startsWith('name:'))){
   reject('UNVERIFIED_PLAYER_ID');continue
  }
  const placed=Date.parse(q.placedAt),closed=Date.parse(q.closedAt),start=Date.parse(q.startsAt);
  if(!Number.isFinite(placed)||!Number.isFinite(closed)||!Number.isFinite(start)||
   placed>=closed||closed>start||start>now){
   reject('INVALID_PRICE_TIMELINE');continue;
  }
  const key=JSON.stringify([q.bookmaker.trim().toLowerCase(),q.eventId,q.marketType,
   q.outcomeId,q.playerId||'',q.line||'',q.placedAt,q.closedAt]);
  if(seen.has(key)){reject('DUPLICATE_PAIR');continue}
  seen.add(key);
  // Decimal-price ratio is a realized *price comparison*, not realized ROI.
  const clv=(decimal(q.placedAmericanOdds)/decimal(q.closingAmericanOdds)-1)*100;
  rows.push({eventId:q.eventId,marketType:q.marketType,outcomeId:q.outcomeId,
   bookmaker:q.bookmaker,closingLineValuePercent:clv,
   closingImpliedProbability:1/decimal(q.closingAmericanOdds),
   placedImpliedProbability:1/decimal(q.placedAmericanOdds),
   beatClose:clv>0,placedAmericanOdds:q.placedAmericanOdds,
   closingAmericanOdds:q.closingAmericanOdds});
 }
 const average=rows.length?rows.reduce((s,r)=>s+r.closingLineValuePercent,0)/rows.length:null;
 return {mode:'HISTORICAL_PRICE_COMPARISON' as const,receivedPairs:pairs.length,
  comparablePairs:rows.length,rejected:reasons,averageClvPercent:average,
  beatCloseCount:rows.filter(r=>r.beatClose).length,rows,
  actualProfitVerified:false,sourceAuthenticityVerified:false,
  settlementVerified:false,modelCalibrationVerified:false,releaseCertified:false,
  warning:'CLV is not a guaranteed edge or proof of ROI. The inputs must be independently authenticated and markets must be confirmed equivalent.'};
}
