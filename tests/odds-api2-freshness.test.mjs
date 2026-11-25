import test from 'node:test';
import assert from 'node:assert/strict';
import {fixtureNow,loadOddsApi2Normalizer,oddsApi2Payload} from './helpers/load-odds-api2.mjs';

const sourceAtAge=ageMs=>new Date(fixtureNow-ageMs).toISOString();

test('default freshness accepts prices through twenty minutes and rejects older evidence',()=>{
 const runtime=loadOddsApi2Normalizer();
 assert.equal(runtime.provider().maxAgeMin,20);
 for(const ageMs of [0,60000,20*60000]){
  const rows=runtime.normalize(oddsApi2Payload({updated_at:sourceAtAge(ageMs)}));
  assert.equal(rows.length,1,`age=${ageMs}`);
  assert.equal(rows[0].pulledAt,sourceAtAge(ageMs));
 }
 for(const ageMs of [20*60000+1,21*60000,86400000]){
  assert.equal(runtime.normalize(oddsApi2Payload({updated_at:sourceAtAge(ageMs)})).length,0,`age=${ageMs}`);
 }
 assert.equal(runtime.networkRequests,0);
});

test('future source observations are limited to the thirty-second clock-skew boundary',()=>{
 const runtime=loadOddsApi2Normalizer();
 for(const futureMs of [1,30000]){
  const sourceTime=sourceAtAge(-futureMs);
  const rows=runtime.normalize(oddsApi2Payload({updated_at:sourceTime}));
  assert.equal(rows.length,1);
  assert.equal(rows[0].pulledAt,sourceTime);
 }
 for(const futureMs of [30001,60000,86400000]){
  assert.equal(runtime.normalize(oddsApi2Payload({updated_at:sourceAtAge(-futureMs)})).length,0);
 }
 assert.equal(runtime.networkRequests,0);
});

test('configured maximum age controls acceptance for shorter, fractional and longer windows',()=>{
 for(const minutes of [2.5,5,45]){
  const runtime=loadOddsApi2Normalizer({env:{ODDS_API_2_MAX_AGE_MIN:String(minutes)}});
  assert.equal(runtime.provider().maxAgeMin,minutes);
  const boundary=minutes*60000;
  const rows=runtime.normalize(oddsApi2Payload({updated_at:sourceAtAge(boundary)}));
  assert.equal(rows.length,1,`maximum=${minutes}`);
  assert.equal(rows[0].pulledAt,sourceAtAge(boundary));
  assert.equal(runtime.normalize(oddsApi2Payload({updated_at:sourceAtAge(boundary+1)})).length,0);
  assert.equal(runtime.networkRequests,0);
 }
});

test('configured maximum age has a one-minute minimum',()=>{
 for(const configured of ['0','-5','0.5']){
  const runtime=loadOddsApi2Normalizer({env:{ODDS_API_2_MAX_AGE_MIN:configured}});
  assert.equal(runtime.provider().maxAgeMin,1,configured);
  assert.equal(runtime.normalize(oddsApi2Payload({updated_at:sourceAtAge(60000)})).length,1,configured);
  assert.equal(runtime.normalize(oddsApi2Payload({updated_at:sourceAtAge(60001)})).length,0,configured);
  assert.equal(runtime.networkRequests,0);
 }
});

test('invalid and overflowing configuration cannot disable the stale-price rejection',()=>{
 for(const configured of ['', ' ', 'nonsense', 'NaN', 'Infinity', '-Infinity', '1e309', '1e308', '-1e308']){
  const runtime=loadOddsApi2Normalizer({env:{ODDS_API_2_MAX_AGE_MIN:configured}});
  assert.equal(runtime.provider().maxAgeMin,20,JSON.stringify(configured));
  assert.equal(runtime.normalize(oddsApi2Payload({updated_at:sourceAtAge(20*60000)})).length,1,configured);
  for(const ageMs of [20*60000+1,86400000]){
   assert.equal(runtime.normalize(oddsApi2Payload({updated_at:sourceAtAge(ageMs)})).length,0,configured);
  }
  assert.equal(runtime.networkRequests,0);
 }
});

test('fresh receipt metadata cannot renew a stale last_update timestamp',()=>{
 const runtime=loadOddsApi2Normalizer();
 const payload=oddsApi2Payload({last_update:sourceAtAge(21*60000),receivedAt:sourceAtAge(0),pulledAt:sourceAtAge(0)});
 payload.receivedAt=sourceAtAge(0);
 assert.equal(runtime.normalize(payload).length,0);
 assert.equal(runtime.networkRequests,0);
});
