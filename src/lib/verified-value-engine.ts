/**
 * EdgeForce Stage 2: conservative pure value-bet evaluator.
 * Real market quotes and independently calibrated forecasts MUST be supplied;
 * no probability or simulated outcome is manufactured here.
 */
export type MarketQuote={
 bookmaker:string;sourceUpstreamId:string;eventId:string;marketType:string;outcomeId:string;
 americanOdds:number;observedAt:string;startsAt:string;line?:string;playerId?:string;
};
export type ProbabilityEvidence={
 probability:number;modelId:string;modelVersion:string;calibrated:boolean;
 independentlyDerived:boolean;asOf:string;sampleSize:number;
 calibrationMeanAbsoluteError:number; // 0..1, measured on held-out probability bins
};
export type QuoteEvidence={
 independentUpstreams:number;priceAgreement:boolean;sourceEntitlementVerified:boolean;
};
export type EdgeSignalInput={quote:MarketQuote;forecast:ProbabilityEvidence;verification:QuoteEvidence};
const stamp=(t:string)=>Date.parse(t);
const str=(v:unknown)=>typeof v==='string'&&v.trim().length>0;
const pNum=(v:unknown)=>typeof v==='number'&&Number.isFinite(v);
export function americanBreakEven(odds:number){
 if(!Number.isInteger(odds)||!Number.isSafeInteger(odds)||Math.abs(odds)<100)throw Error('INVALID_AMERICAN_ODDS');
 return odds>0?100/(odds+100):(-odds)/(-odds+100);
}
export function evaluateIndependentBetEdge(input:EdgeSignalInput,now=Date.now()){
 if(!input||!Number.isFinite(now))throw Error('INVALID_EDGE_INPUT');
 const {quote:q,forecast:f,verification:v}=input;
 if(!q||!f||!v)throw Error('INCOMPLETE_EDGE_EVIDENCE');
 const reasons:string[]=[];
 if(![q.bookmaker,q.sourceUpstreamId,q.eventId,q.marketType,q.outcomeId].every(str)||!pNum(q.americanOdds)||
   !Number.isInteger(q.americanOdds)||!Number.isSafeInteger(q.americanOdds)||Math.abs(q.americanOdds)<100)
   reasons.push('INVALID_MARKET_QUOTE');
 const observed=stamp(q.observedAt),starts=stamp(q.startsAt);
 if(!Number.isFinite(observed)||observed>now||now-observed>15*60*1000||
   !Number.isFinite(starts)||starts<=now)reasons.push('MARKET_NOT_LIVE_OR_TOO_STALE');
 if(q.marketType.startsWith('player_')&&!str(q.playerId))reasons.push('UNVERIFIED_PLAYER_ID');
 if(q.marketType!=='h2h'&&!str(q.line))reasons.push('MISSING_MARKET_LINE');
 if(v.sourceEntitlementVerified!==true)reasons.push('SOURCE_ENTITLEMENT_NOT_CERTIFIED');
 if(!Number.isSafeInteger(v.independentUpstreams)||v.independentUpstreams<2||v.priceAgreement!==true)
   reasons.push('INDEPENDENT_PRICE_CONFIRMATION_MISSING');
 if(!pNum(f.probability)||f.probability<=0||f.probability>=1||!str(f.modelId)||!str(f.modelVersion)||
   !Number.isFinite(stamp(f.asOf))||stamp(f.asOf)>now||now-stamp(f.asOf)>24*60*60*1000)
   reasons.push('MISSING_INDEPENDENT_PROBABILITY_EVIDENCE');
 if(f.independentlyDerived!==true||f.calibrated!==true||!Number.isSafeInteger(f.sampleSize)||
  f.sampleSize<100||!pNum(f.calibrationMeanAbsoluteError)||f.calibrationMeanAbsoluteError<0||
  f.calibrationMeanAbsoluteError>0.1)reasons.push('MODEL_CALIBRATION_NOT_CERTIFIED');
 if(reasons.length)return {status:'BLOCKED' as const,eligible:false,reasons,
   breakEvenProbability:null,estimatedProbability:null,edgePercentagePoints:null,
   expectedRoiPercent:null,fullKellyFraction:null,suggestedBankrollFraction:0,
   note:'Blocked inputs cannot be ranked as verified betting opportunities.'};
 const breakeven=americanBreakEven(q.americanOdds);
 const netProfitPerDollar=q.americanOdds>0?q.americanOdds/100:100/(-q.americanOdds);
 const probability=f.probability;
 const edge=probability-breakeven;
 const roi=probability*netProfitPerDollar-(1-probability);
 const kelly=Math.max(0,Math.min(1,roi/netProfitPerDollar));
 const positive=roi>0&&edge>0;
 return {status:positive?'VERIFIED_CANDIDATE' as const:'NO_POSITIVE_EDGE' as const,
  eligible:positive,reasons:[],
  breakEvenProbability:breakeven,estimatedProbability:probability,
  edgePercentagePoints:edge*100,expectedRoiPercent:roi*100,
  fullKellyFraction:kelly,
  // Quarter-Kelly with strict 1% bankroll cap is a conservative reference,
  // not an instruction or guaranteed strategy.
  suggestedBankrollFraction:positive?Math.min(0.01,kelly/4):0,
  modelId:f.modelId,modelVersion:f.modelVersion,calibrationSampleSize:f.sampleSize,
  note:'Model-derived EV is uncertain, not guaranteed profit; measured calibration quality must be independently audited.'};
}
