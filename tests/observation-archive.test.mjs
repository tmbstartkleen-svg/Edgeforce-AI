import test from 'node:test';import assert from 'node:assert/strict';
import {sealObservation,archivalManifest} from '../src/lib/intelligence-core/observation-archive.mjs';
const now=Date.now();
const sport={sourceId:'s',upstreamId:'u',division:'SPORTS',domain:'NFL',licenseApproved:true,enabled:true,permissionScope:'READ_PUBLIC_API',observedAt:now};
const nonSports={...sport,sourceId:'p',division:'PREDICTION_MARKETS',domain:'ECONOMICS'};
const item={source:sport,sourceEventId:'game-1',kind:'score',observedAt:now,payload:{home:7},receivedAt:now};
test('seal preserves provenance, hash and read-only legacy marker',()=>{
 const value=sealObservation(item);
 assert.equal(value.division,'SPORTS');
 assert.equal(value.retention,'APPEND_ONLY');
 assert.equal(value.legacyMigration,'NOT_PERFORMED');
 assert.match(value.payloadSha256,/^[a-f0-9]{64}$/);
 assert.equal(JSON.parse(value.rawPayload).home,7);
});
test('separate non-sports contract observations',()=>{
 const x=sealObservation({...item,source:nonSports,kind:'prediction-market'});
 assert.equal(x.division,'PREDICTION_MARKETS');
 assert.throws(()=>sealObservation({...item,source:nonSports}),/NON_SPORTS_KIND_MISMATCH/);
});
test('reject duplicate event records in one batch',()=>{
 assert.throws(()=>archivalManifest([item,item]),/DUPLICATE_OBSERVATION_IN_BATCH/);
 assert.equal(archivalManifest([item]).historicalNeonDataModified,false);
});
