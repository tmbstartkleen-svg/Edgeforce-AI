/**
 * Read-only, bounded D1 adapter for reconciliation of a controlled pilot
 * ingest batch. Never calls an odds provider or performs mutations.
 * Caller supplies expected observations; enabled registration alone is NOT 
 * entitlement to store sportsbook odds or proof of authenticated collection.
 */
import type {D1Database} from '../../worker/d1-observations';
import type {PreparedOddsObservation} from './the-odds-api-d1-preparation';
import {verifyPreparedOddsReadback,type StoredOddsRow} from './d1-odds-readback-verification';

export async function readAndVerifyD1OddsBatch(
 db:D1Database,expected:PreparedOddsObservation[],now=Date.now()
){
 if(!db||typeof db.prepare!=='function')throw Error('D1_BINDING_MISSING');
 if(!Array.isArray(expected)||expected.length===0||expected.length>25||!Number.isFinite(now))
  throw Error('INVALID_EXPECTED_ODDS_BATCH');
 const source=expected[0]?.provider,upstream=expected[0]?.upstreamId;
 if(!source||!upstream||expected.some(x=>!x||x.provider!==source||x.upstreamId!==upstream))
  throw Error('MIXED_ODDS_SOURCE_BATCH');
 const events=[...new Set(expected.map(x=>x.eventId))];
 if(events.some(e=>typeof e!=='string'||!e.trim()))throw Error('INVALID_EVENT_IDS');
 const sql=`SELECT o.source_id,o.upstream_id,o.event_id,o.market_id,
   o.observation_kind,o.observed_at,o.payload
   FROM intelligence_observations AS o
   INNER JOIN intelligence_sources AS s ON s.source_id=o.source_id
     AND s.upstream_id=o.upstream_id AND s.enabled=1
     AND s.source_type='sportsbook-odds'
   WHERE o.observation_kind='odds' AND o.source_id=? AND o.upstream_id=?
     AND o.event_id IN (${events.map(() => '?').join(',')})
     AND o.observed_at>=?
   ORDER BY o.observed_at DESC LIMIT 250`;
 const rows=await db.prepare(sql).bind(
  source,upstream,...events,new Date(now-15*60*1000).toISOString()
 ).all<StoredOddsRow>();
 const result=verifyPreparedOddsReadback(expected,rows.results,now);
 const saturated=rows.results.length>=250;
 return {...result,
  mode:'REGISTERED_SOURCE_D1_READ_ONLY_RECONCILIATION' as const,
  sourceEntitlementVerified:false,authenticatedCollectionVerified:false,
  exactReadbackComplete:result.exactReadbackComplete&&!saturated,
  querySaturated:saturated,
  sourceId:source,upstreamId:upstream,
  readOnly:true,writesPerformed:0,
  releaseCertified:false,
  certificationBlockers:['SOURCE_ENTITLEMENT_NOT_VERIFIED','AUTHENTICATED_COLLECTION_NOT_VERIFIED','INDEPENDENT_UPSTREAM_NOT_VERIFIED'],
  ...(saturated?{readbackWarning:'D1_QUERY_CAP_REACHED_UNABLE_TO_CERTIFY'}:{})
 };
}
