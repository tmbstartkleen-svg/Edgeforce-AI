import {joinAuthorizedSoccerMarkets} from './soccer-market-identity-join.mjs';
import {assessSoccerProviderReadiness} from './soccer-provider-readiness.mjs';
/** Pure boundary for future licensed odds + approved score observations. Never grants provider approval itself. */
export function certifySoccerRuntimeEvidence({markets=[],scores=[],quotes=[],sources=[],now=Date.now()}={}){
 const readiness=assessSoccerProviderReadiness({sources,marketRows:quotes.map(q=>({...q,id:q.marketId,sourceProviderId:q.providerId})),now});
 const approvedIds=new Set(readiness.sourceIds);
 const qualifyingQuotes=quotes.filter(q=>approvedIds.has(q.marketId)&&readiness.approvedUpstreams.some(s=>s.providerId===q.providerId));
 const joined=joinAuthorizedSoccerMarkets({markets,scores,quotes:qualifyingQuotes,now});
 return {providerReady:readiness.ready,approvedMarketCount:joined.approved,withheldMarketCount:joined.withheld,
  marketDecisions:joined.results,authorizedUpstreams:readiness.approvedUpstreams,
  fullDraftKingsInventoryCertified:false,certification:'MARKET_LEVEL_ONLY_NOT_FULL_LEAGUE_COVERAGE'};
}
