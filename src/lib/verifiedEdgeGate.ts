import {calculateEdgeValue} from './edgeValue';

export type VerifiedEdgeInputs={
 americanOdds:number;modelProbability:number;eventId:string;marketId:string;
 sportsbook:string;oddsUpstreamId:string;oddsObservedAt:string;
 modelId:string;modelValidated:boolean;independentOddsSources:number;
};

/** Never turn illustrative pricing math into a verified recommendation without evidence. */
export function evaluateVerifiedEdge(input:VerifiedEdgeInputs,now=Date.now()){
 const value=calculateEdgeValue(input.americanOdds,input.modelProbability);
 const observed=Date.parse(input.oddsObservedAt);
 const blockers:string[]=[];
 if(!input.eventId?.trim()||!input.marketId?.trim())blockers.push('MISSING_MARKET_IDENTITY');
 if(!input.sportsbook?.trim()||!input.oddsUpstreamId?.trim())blockers.push('MISSING_ODDS_SOURCE');
 if(!Number.isFinite(observed)||observed>now+30000||now-observed>120000)blockers.push('STALE_OR_INVALID_ODDS');
 if(!input.modelId?.trim()||!input.modelValidated)blockers.push('MODEL_NOT_VALIDATED');
 if(!Number.isInteger(input.independentOddsSources)||input.independentOddsSources<2)blockers.push('INSUFFICIENT_INDEPENDENT_ODDS_SOURCES');
 if(value.probabilityEdgePp<=0)blockers.push('NO_POSITIVE_EDGE');
 return {...value,evidenceReady:blockers.length===0,blockers,
  approvalScope:'INPUT_ASSERTIONS_ONLY',upstreamIdentityIndependentlyAuthenticated:false,
  productionBetRecommendationAuthorized:false};
}
