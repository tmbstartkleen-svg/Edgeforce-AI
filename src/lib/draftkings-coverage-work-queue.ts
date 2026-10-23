/**
 * Stage 3 operator backlog, combining observed missing-price gaps and
 * optional historical multi-snapshot continuity. This does not claim that
 * DraftKings has removed a market; it prioritizes verification work.
 */
import type {RequiredMarket} from './draftkings-market-gap-audit';
import {auditFullDraftKingsOddsExport} from './full-draftkings-export-audit';
import {auditDraftKingsCoverageContinuity,type CoverageSnapshot} from './draftkings-coverage-continuity';
const clean=(s:string)=>s.trim().toLowerCase();
const key=(r:RequiredMarket)=>JSON.stringify([clean(r.sport),clean(r.league),clean(r.marketType),
 r.kind,clean(r.eventId||''),clean(r.playerId||''),clean(r.line||'')]);
export function buildDraftKingsCoverageWorkQueue(
 events:unknown,expected:RequiredMarket[],snapshots:CoverageSnapshot[]=[],now=Date.now(),limit=100
){
 if(!Number.isSafeInteger(limit)||limit<1||limit>500||!Array.isArray(snapshots))
  throw Error('INVALID_GAP_WORK_QUEUE');
 const audit=auditFullDraftKingsOddsExport(events,expected,now);
 const history=snapshots.length?auditDraftKingsCoverageContinuity(expected,snapshots,now):null;
 const persistent=new Set((history?.persistentMissing||[]).map(key));
 const intermittent=new Set((history?.intermittentMissing||[]).map(key));
 const rows=audit.missing.map((r,i)=>{
  const k=key(r as RequiredMarket);
  const isProp=r.kind==='player-prop';
  const historical=persistent.has(k)?'PERSISTENT_MISSING':intermittent.has(k)?
   'INTERMITTENT_MISSING':'UNCLASSIFIED';
  // Priorities express investigation order, never confidence in a bet.
  const priority=historical==='PERSISTENT_MISSING'?'P1':
   isProp?'P1':historical==='INTERMITTENT_MISSING'?'P2':'P3';
  const owner=isProp?'PLAYER_IDENTITY_AND_PROPS':
   r.reason==='REQUIRED_EVENT_NOT_PRICED'?'EVENT_MARKET_COVERAGE':'LEAGUE_MARKET_DISCOVERY';
  return {id:'gap-'+i,priority,owner,historical,
   sport:r.sport,league:r.league,marketType:r.marketType,kind:r.kind,
   ...(r.eventId?{eventId:r.eventId}:{}),
   ...(r.playerId?{playerId:r.playerId}:{}),...(r.line?{line:r.line}:{}),
   reason:r.reason,
   nextAction:isProp?'Match athlete to an authenticated stable ID, then verify the exact event/line price':
    historical==='PERSISTENT_MISSING'?'Investigate provider catalog restrictions and independent upstream availability':
    'Check fresh authorized DraftKings-priced outcomes for this exact requirement'};
 });
 const rank={P1:0,P2:1,P3:2};
 rows.sort((a,b)=>rank[a.priority]-rank[b.priority]||a.sport.localeCompare(b.sport)||
  a.league.localeCompare(b.league)||a.marketType.localeCompare(b.marketType)||a.id.localeCompare(b.id));
 const byOwner=rows.reduce((acc,r)=>{acc[r.owner]=(acc[r.owner]||0)+1;return acc},
  {} as Record<string,number>);
 const byPriority=rows.reduce((acc,r)=>{acc[r.priority]=(acc[r.priority]||0)+1;return acc},
  {P1:0,P2:0,P3:0});
 return {mode:'OPERATOR_COVERAGE_INVESTIGATION_QUEUE' as const,
  asOf:new Date(now).toISOString(),scope:'SUPPLIED_CATALOG_ONLY',
  requirements:audit.requiredCount,covered:audit.coveredCount,
  missing:audit.missingCount,unmappedMarkets:audit.unmappedMarkets,
  playerPropsWithUnverifiedIds:audit.provisionalPlayerPropOutcomes,
  historySnapshots:history?.snapshotCount??0,
  persistentMissing:history?.persistentMissingCount??0,
  intermittentMissing:history?.intermittentMissingCount??0,
  byOwner,byPriority,queueCount:rows.length,
  displayedCount:Math.min(rows.length,limit),truncated:rows.length>limit,
  rows:rows.slice(0,limit),readyForProduction:false,
  verifiedBets:0,releaseCertified:false,
  warning:'Operator investigation priorities do not establish full DraftKings network coverage, source authorization, valid betting prices or model predictions.'};
}
