/**
 * Combine authorized The Odds API response sample with an explicit
 * separately sourced DraftKings market catalog. Offline and no-write.
 * The Odds API preparation is capped at 25 outcomes, therefore any truncated
 * sample is strictly incapable of certifying full coverage.
 */
import {prepareTheOddsApiD1Batch} from './the-odds-api-d1-preparation';
import {auditDraftKingsMarketCoverage,type RequiredMarket,type ObservedMarket} from './draftkings-market-gap-audit';
export function auditTheOddsApiDraftKingsGaps(
 events:unknown,expected:RequiredMarket[],now=Date.now(),enablePlayerProps=false
){
 const prepared=prepareTheOddsApiD1Batch(events,now,25,{enablePlayerProps});
 const quotes:ObservedMarket[]=prepared.rows.map(row=>({
  sport:row.value.sport,league:row.value.league,marketType:row.value.marketType,
  eventId:row.eventId,bookmaker:row.value.bookmaker,sourceUpstreamId:row.upstreamId,
  observedAt:new Date(row.observedAt).toISOString(),startsAt:row.value.startsAt,
  outcomeId:row.value.outcomeId,americanOdds:row.value.priceAmerican,
  ...(row.value.playerId?{playerId:row.value.playerId}:{}),
  ...(row.value.line?{line:row.value.line}:{})
 }));
 const result=auditDraftKingsMarketCoverage(expected,quotes,now);
 const provisionalProps=prepared.rows.filter(r=>r.value.playerIdentityStatus==='UNVERIFIED_NAME_ONLY').length;
 const truncated=prepared.sampleTruncated;
 return {mode:'ODDS_API_DK_COVERAGE_PREFLIGHT' as const,
  ...result,
  coverageComplete:result.coverageComplete&&!truncated&&provisionalProps===0,
  sampleTruncated:truncated,preparedQuotes:prepared.prepared,
  provisionalPlayerProps:provisionalProps,
  discardedEvents:prepared.eventAudit,rejectedProviderOutcomes:prepared.rejected,
  unmappedMarkets:prepared.unmappedMarketTypes,
  catalogExternallyAuthenticated:false,oddsApiStorageEntitlementVerified:false,
  fullDraftKingsNetworkCoverageVerified:false,releaseCertified:false,
  warning:'Only a maximum 25-row sample is mapped. Real DraftKings catalog, provider rights, stable athlete IDs and untruncated independent upstream evidence remain separate prerequisites.'};
}
