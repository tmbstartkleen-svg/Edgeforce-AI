/** EdgeForce first-party market intelligence: observation-backed only, no polling or synthetic odds. */
import {auditMarketObservations,evaluateVerifiedEdge} from './sports-network-engine.mjs';

const validPrice=(n)=>Number.isFinite(n)&&Number.isInteger(n)&&(n<=-100||n>=100);
export function decimalOdds(american){
 if(!validPrice(american))throw new TypeError('INVALID_AMERICAN_ODDS');
 return american>0?1+american/100:1+100/(-american);
}
export function impliedProbability(american){return 1/decimalOdds(american);}

/** Quote eligibility is separate from ingestion and requires documented observation evidence. */
export function validatedQuote(quote,{now=Date.now(),maxAgeMs=1200000}={}){
 if(!quote||typeof quote!=='object'||!validPrice(quote.odds)||
  !['SPORTSBOOK','PREDICTION_MARKET'].includes(quote.venueType)||
  !['BACK','YES'].includes(quote.side)||
  !['TWO_WAY','THREE_WAY'].includes(quote.outcomeSetType)||
  ![2,3].includes(quote.outcomes?.length)||quote.outcomes.length!==(quote.outcomeSetType==='TWO_WAY'?2:3)||
  new Set(quote.outcomes).size!==quote.outcomes.length||!quote.outcomes.includes(quote.selection)||
  ![quote.eventId,quote.marketKey,quote.selection,quote.bookmaker,quote.upstreamId,quote.providerId,
    quote.settlementKey,quote.currency].every(x=>typeof x==='string'&&x.trim())||
  !Number.isFinite(quote.observedAt)||quote.observedAt>now+60000||now-quote.observedAt>maxAgeMs)
  return {ok:false,reason:'INVALID_STALE_OR_UNMATCHED_QUOTE'};
 return {ok:true,quote:{...quote,decimalOdds:decimalOdds(quote.odds),impliedProbability:impliedProbability(quote.odds)}};
}

/** Finds only matched exhaustive outcome sets, using distinct actual venues; no fabricated market availability. */
export function scanArbitrage(quotes,{now=Date.now(),maxAgeMs=1200000,maxMarkets=1000,bankroll=100}={}){
 if(!Array.isArray(quotes)||!Number.isFinite(now)||!Number.isFinite(maxAgeMs)||maxAgeMs<=0||
  !Number.isInteger(maxMarkets)||maxMarkets<0||maxMarkets>5000||!Number.isFinite(bankroll)||bankroll<=0)
  throw new TypeError('INVALID_ARBITRAGE_SCAN');
 const rejected=[],groups=new Map();
 for(const raw of quotes.slice(0,10000)){
  const checked=validatedQuote(raw,{now,maxAgeMs});
  if(!checked.ok){rejected.push(checked.reason);continue;}
  const q=checked.quote;
  // Different settlement rules, venue products, line points or currencies MUST NOT be combined.
  const key=JSON.stringify([q.eventId,q.marketKey,q.settlementKey,q.currency,q.venueType,q.outcomeSetType,[...q.outcomes].sort()]);
  if(!groups.has(key))groups.set(key,[]);groups.get(key).push(q);
 }
 const opportunities=[],blocked=[];
 for(const [key,group] of [...groups].slice(0,maxMarkets)){
  const required=group[0].outcomes;
  const top=[];
  for(const selection of required){
   const best=group.filter(q=>q.selection===selection)
    .sort((a,b)=>b.decimalOdds-a.decimalOdds||b.observedAt-a.observedAt)[0];
   if(best)top.push(best);
  }
  if(top.length!==required.length){blocked.push({marketKey:group[0].marketKey,reason:'INCOMPLETE_OUTCOME_COVERAGE'});continue;}
  if(new Set(top.map(q=>q.bookmaker)).size<2){blocked.push({marketKey:group[0].marketKey,reason:'ONE_VENUE_NOT_ARBITRAGE'});continue;}
  const inverseSum=top.reduce((sum,q)=>sum+1/q.decimalOdds,0);
  if(inverseSum>=1)continue;
  const stakes=top.map(q=>({selection:q.selection,bookmaker:q.bookmaker,upstreamId:q.upstreamId,
    odds:q.odds,observedAt:q.observedAt,stake:bankroll*(1/q.decimalOdds)/inverseSum}));
  const payout=bankroll/inverseSum;
  const independentlyOwnedUpstreams=new Set(top.map(q=>q.upstreamId)).size;
  const blockers=[];
  if(independentlyOwnedUpstreams<2)blockers.push('INDEPENDENT_UPSTREAM_PROVENANCE_UNVERIFIED');
  if(top.some(q=>q.bookmaker==='DraftKings'&&q.venueType!=='SPORTSBOOK'))blockers.push('BOOKMAKER_VENUE_MISMATCH');
  opportunities.push({eventId:top[0].eventId,marketKey:top[0].marketKey,settlementKey:top[0].settlementKey,
   currency:top[0].currency,venueType:top[0].venueType,impliedProbabilitySum:inverseSum,
   theoreticalProfit: payout-bankroll,theoreticalRoiPct:(1/inverseSum-1)*100,
   independentlyOwnedUpstreams,stakes,blockers,
   status:blockers.length?'UNVERIFIED_OPPORTUNITY':'THEORETICAL_ARBITRAGE',
   notes:['Not executable verification: limits, suspensions, slippage, fees, liquidity, stake rounding and settlement differences require venue-specific checks.']});
 }
 return {mode:'SOURCE_QUOTE_ANALYSIS_ONLY',evaluatedGroups:groups.size,opportunities:opportunities.sort((a,b)=>b.theoreticalRoiPct-a.theoreticalRoiPct),blocked,rejectedCount:rejected.length,externalRequests:0,ordersPlaced:0};
}

/** Screen for EV only when independent model probability and target bookmaker quote both exist. */
export function screenValueEdges(quotes,forecasts,{now=Date.now(),targetBook='DraftKings',maxAgeMs=1200000}={}){
 if(!Array.isArray(quotes)||!Array.isArray(forecasts))throw new TypeError('INVALID_VALUE_SCAN');
 const provenance=auditMarketObservations(quotes.filter(q=>q?.venueType==='SPORTSBOOK').map(q=>({
   providerId:q.providerId,upstreamId:q.upstreamId,bookmaker:q.bookmaker,eventId:q.eventId,
   marketKey:q.marketKey,selectionKey:q.selection,odds:q.odds,observedAt:q.observedAt
  })),{now,targetBook,maxAgeMs});
 const byKey=new Map(provenance.markets.map(p=>[p.marketId,p]));
 const results=[];
 for(const forecast of forecasts.slice(0,5000)){
  if(!forecast||!['INDEPENDENT','CALIBRATED'].includes(forecast.modelType)||
   typeof forecast.eventId!=='string'||typeof forecast.marketKey!=='string'||typeof forecast.selection!=='string')continue;
  const key=[forecast.eventId,forecast.marketKey,forecast.selection].join('|');
  const observed=byKey.get(key);
  const target=quotes.filter(q=>q.eventId===forecast.eventId&&q.marketKey===forecast.marketKey&&
   q.selection===forecast.selection&&q.bookmaker?.toLowerCase()===targetBook.toLowerCase()&&
   q.venueType==='SPORTSBOOK'&&validatedQuote(q,{now,maxAgeMs}).ok)
    .sort((a,b)=>b.observedAt-a.observedAt)[0];
  if(!target)continue;
  const edge=evaluateVerifiedEdge({americanOdds:target.odds,modelProbability:forecast.probability,
   modelCalibrated:forecast.modelType==='CALIBRATED'&&forecast.outOfSampleVerified===true,
   sourceAudited:forecast.sourceAudited===true,independentUpstreams:observed?.independentUpstreamCount??0,
   targetBookObserved:Boolean(observed?.targetBookObserved)});
  results.push({eventId:forecast.eventId,marketKey:forecast.marketKey,selection:forecast.selection,
   targetBook,sourceObservedAt:target.observedAt,odds:target.odds,...edge});
 }
 return {mode:'VERIFIED_PRICE_MODEL_SCREEN',results:results.sort((a,b)=>(b.expectedRoi??-Infinity)-(a.expectedRoi??-Infinity)),
  pricesInvented:0,modelProbabilitiesInvented:0,networkRequests:0};
}
