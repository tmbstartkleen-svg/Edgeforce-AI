/**
 * Stage 3 multi-snapshot DraftKings coverage continuity.
 * Looks for persistent versus intermittent uncovered event/market/player lines
 * in a controlled, authorized series of odds snapshots. Missing prices are
 * observations, not proof that DraftKings delisted a market.
 */
import {auditDraftKingsMarketCoverage,type RequiredMarket,type ObservedMarket} from './draftkings-market-gap-audit';
export type CoverageSnapshot={asOf:string;quotes:ObservedMarket[];sourceId:string};
const text=(v:unknown)=>typeof v==='string'&&v.trim().length>0;
const norm=(v:string)=>v.trim().toLowerCase();
const identity=(r:RequiredMarket)=>JSON.stringify([norm(r.sport),norm(r.league),
 norm(r.marketType),r.kind,norm(r.eventId||''),norm(r.playerId||''),norm(r.line||'')]);
export function auditDraftKingsCoverageContinuity(
 expected:RequiredMarket[],snapshots:CoverageSnapshot[],now=Date.now()){
 if(!Array.isArray(expected)||expected.length>5000||!Array.isArray(snapshots)||
  snapshots.length>24||!Number.isFinite(now))throw Error('INVALID_CONTINUITY_INPUT');
 const sequence:Array<{asOf:string;sourceId:string;coveredCount:number;
  missingCount:number;coveragePercent:number|null;rejected:Record<string,number>;
  missingKeys:Set<string>} >=[];
 const duplicateRequirements=new Set<string>();
 const required=new Map<string,RequiredMarket>();
 for(const r of expected){
  if(!r||![r.sport,r.league,r.marketType].every(text)||!['game','player-prop'].includes(r.kind)||
   (r.eventId!==undefined&&!text(r.eventId))||
   (r.playerId!==undefined&&!text(r.playerId))||(r.line!==undefined&&!text(r.line)))
   throw Error('INVALID_EXPECTED_MARKET');
  const key=identity(r);
  if(required.has(key))duplicateRequirements.add(key);
  required.set(key,r);
 }
 let previous=-Infinity;
 for(const s of snapshots){
  if(!s||!text(s.sourceId)||!Array.isArray(s.quotes)||s.quotes.length>50000||
    !Number.isFinite(Date.parse(s.asOf)))throw Error('INVALID_CONTINUITY_SNAPSHOT');
  const stamp=Date.parse(s.asOf);
  if(stamp<=previous||stamp>now||now-stamp>7*86400000)
   throw Error('INVALID_CONTINUITY_TIME_SEQUENCE');
  previous=stamp;
  const result=auditDraftKingsMarketCoverage([...required.values()],s.quotes,stamp);
  sequence.push({asOf:s.asOf,sourceId:s.sourceId,coveredCount:result.coveredCount,
   missingCount:result.missingCount,coveragePercent:result.coveragePercent,
   rejected:result.rejected,missingKeys:new Set(result.missing.map(r=>identity(r as RequiredMarket)))});
 }
 const missing=[] as Array<{sport:string;league:string;marketType:string;kind:string;
  eventId?:string;playerId?:string;line?:string;missingSnapshots:number;
  totalSnapshots:number;persistent:boolean;intermittent:boolean}>;
 for(const [key,r] of required){
  const count=sequence.filter(s=>s.missingKeys.has(key)).length;
  if(count===0)continue;
  missing.push({...r,missingSnapshots:count,totalSnapshots:sequence.length,
   persistent:sequence.length>=2&&count===sequence.length,
   intermittent:count<sequence.length});
 }
 const recent=sequence.at(-1);
 const persistent=missing.filter(m=>m.persistent);
 const intermittent=missing.filter(m=>m.intermittent);
 return {mode:'DRAFTKINGS_MULTISNAPSHOT_COVERAGE_RESEARCH' as const,
  expectedCount:required.size,snapshotCount:sequence.length,
  uniqueSourceIds:[...new Set(sequence.map(s=>norm(s.sourceId)))].sort(),
  latestCoveragePercent:recent?.coveragePercent??null,
  latestMissingCount:recent?.missingCount??null,
  persistentMissingCount:persistent.length,intermittentMissingCount:intermittent.length,
  persistentMissing:persistent,intermittentMissing:intermittent,
  duplicateExpectedCount:duplicateRequirements.size,
  timeline:sequence.map(({missingKeys,...s})=>s),
  evidenceSufficientForTrend:sequence.length>=2&&required.size>0&&duplicateRequirements.size===0,
  sourceEntitlementVerified:false,expectedCatalogExternallyAuthenticated:false,
  independentUpstreamVerified:false,releaseCertified:false,
  warning:'Missing quotes across snapshots can reflect source outages, market suspension, changing fixture sets or provider catalog limits; do not label them confirmed DraftKings delistings.'};
}
