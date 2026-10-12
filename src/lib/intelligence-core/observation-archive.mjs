/**
 * Non-destructive sports/event-market archival envelope.
 * Validates source provenance, immutable timestamps and exact raw payload digest.
 * This module performs no writes, deletes, scraping, or autonomous execution.
 */
import {createHash} from 'node:crypto';
import {qualifySource} from './source-catalog-gate.mjs';
const TYPES=new Set(['score','odds','injury','lineup','player-stat','weather','prediction-market','result']);
export function sealObservation({source,sourceEventId,sourceMarketId='',kind,observedAt,payload,receivedAt=Date.now()}={}){
 const authorized=qualifySource(source);
 if(!/^[\w:.-]{1,160}$/.test(String(sourceEventId??'')))throw Error('INVALID_EVENT_ID');
 if(sourceMarketId && !/^[\w:.-]{1,160}$/.test(String(sourceMarketId)))throw Error('INVALID_MARKET_ID');
 if(!TYPES.has(kind))throw Error('INVALID_OBSERVATION_KIND');
 if(!Number.isFinite(observedAt)||observedAt>receivedAt+30000||receivedAt-observedAt>86400000)throw Error('INVALID_OBSERVED_AT');
 if(source.division==='PREDICTION_MARKETS'&&kind!=='prediction-market'&&kind!=='result')throw Error('NON_SPORTS_KIND_MISMATCH');
 if(source.division==='SPORTS'&&kind==='prediction-market')throw Error('SPORTS_MARKET_KIND_MISMATCH');
 const raw=JSON.stringify(payload);
 if(!raw||new TextEncoder().encode(raw).length>32768)throw Error('PAYLOAD_TOO_LARGE');
 const sha256=createHash('sha256').update(raw).digest('hex');
 return Object.freeze({version:1,division:authorized.division,domain:authorized.domain,
  sourceId:authorized.sourceId,upstreamId:authorized.upstreamId,sourceEventId,
  sourceMarketId,kind,observedAt,receivedAt,payloadSha256:sha256,rawPayload:raw,
  retention:'APPEND_ONLY',legacyMigration:'NOT_PERFORMED'});
}
export function archivalManifest(records=[]){
 if(!Array.isArray(records)||records.length>25)throw Error('ARCHIVE_BATCH_LIMIT');
 const sealed=records.map(sealObservation);
 const keys=new Set();
 for(const row of sealed){
  const key=[row.division,row.sourceId,row.sourceEventId,row.sourceMarketId,row.kind,row.observedAt,row.payloadSha256].join('|');
  if(keys.has(key))throw Error('DUPLICATE_OBSERVATION_IN_BATCH');
  keys.add(key);
 }
 return {version:1,observations:sealed,recordCount:sealed.length,mode:'VALIDATION_ONLY',
  historicalNeonDataModified:false};
}
