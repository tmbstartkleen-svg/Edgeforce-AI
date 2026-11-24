import {evaluateEntryReplay,type EntryReplayObservation,type EntryReplayCalibration} from './marketEntryReplayCalibration';

/** Explicit evidence gate: diagnostics alone never certify a pricing model. */
export type MarketEntryReadiness={
 status:'blocked'|'review_required';
 reasons:string[];
 diagnostics:EntryReplayCalibration;
};
export function assessMarketEntryReadiness(
 observations:EntryReplayObservation[],
 opts:{minimumSample?:number;maximumBrierScore?:number;minimumDistinctGames?:number}={}
):MarketEntryReadiness{
 const minimumSample=opts.minimumSample??200;
 const maximumBrierScore=opts.maximumBrierScore??0.2;
 const minimumDistinctGames=opts.minimumDistinctGames??50;
 const diagnostics=evaluateEntryReplay(observations,minimumSample);
 const reasons:string[]=[];
 if(!Number.isInteger(minimumDistinctGames)||minimumDistinctGames<30||
 !Number.isFinite(maximumBrierScore)||maximumBrierScore<=0||maximumBrierScore>=1)reasons.push('invalid_readiness_thresholds');
 if(diagnostics.status!=='ready')reasons.push('insufficient_or_invalid_replay');
 const games=new Set(Array.isArray(observations)?observations.map(o=>o.gameId):[]);
 if(games.size<minimumDistinctGames)reasons.push('insufficient_distinct_games');
 if(diagnostics.touchBrierScore===null||diagnostics.touchBrierScore>maximumBrierScore)reasons.push('touch_forecast_not_calibrated');
 if(diagnostics.observedFillRate===null)reasons.push('no_observed_fill_evidence');
 // Requires a human review of data provenance, leakage, book depth, fees,
 // queue position, market settlement rules and out-of-sample performance.
 // Never promote to live execution on metrics alone.
 return {status:reasons.length?'blocked':'review_required',reasons,diagnostics};
}
