import assert from 'node:assert/strict';
import {test} from 'node:test';
import {parseSmokeJson,shouldRetryDegradedHttp,validateObservedOddsSnapshot,validateLiveBoardContinuity} from '../scripts/remote-smoke-response.mjs';
import {loadProvider} from './helpers/load-provider.mjs';

const degraded=new Set(['/api/parlays?size=2&view=today']);

test('V145 retries transient 502/503/504 only for degraded-allowed recommendation paths',()=>{
 for(const status of [502,503,504])assert.equal(shouldRetryDegradedHttp('/api/parlays?size=2&view=today',status,degraded),true);
 assert.equal(shouldRetryDegradedHttp('/api/parlays?size=2&view=today',500,degraded),false);
 assert.equal(shouldRetryDegradedHttp('/api/health',503,degraded),false);
});

test('V145 smoke JSON parser reports non-JSON HTTP response without raw SyntaxError',()=>{
 assert.deepEqual(parseSmokeJson('/x',200,'{"ok":true}'),{ok:true});
 assert.throws(()=>parseSmokeJson('/api/parlays?size=2&view=today',503,'<!DOCTYPE html><html>down</html>'),/returned non-JSON HTTP 503/);
});

const observedRuntime=loadProvider('../observedOdds');
const emptyObserved=()=>observedRuntime.buildObservedOddsSnapshot([]);
const partialBoard=()=>({schema:'edgeforce-live-board-v199',ok:false,degraded:true,
 coreStatus:{ok:false,code:'CORE_TIMEOUT'},rows:[],sports:[],predictions:{contracts:[]},history:{overall:{}},
 historicalBets:[],anomalies:[],resimulationTriggered:false,observedOdds:emptyObserved()});

test('hosted continuity check accepts explicit degraded boards and records their unavailable core',()=>{
 const result=validateLiveBoardContinuity(partialBoard(),503);
 assert.equal(result.coreStatus.code,'CORE_TIMEOUT');
 assert.equal(result.observedOdds.referenceCount,0);
 assert.equal(result.observedOdds.recommendationsAuthorized,false);
});

test('hosted continuity check rejects model rows or action readiness in a failed core response',()=>{
 assert.throws(()=>validateLiveBoardContinuity({...partialBoard(),rows:[{id:'bad'}]},503),/exposed model actions/);
 assert.throws(()=>validateLiveBoardContinuity({...partialBoard(),coreStatus:{ok:true,code:'READY'}},503),/exposed model actions/);
 assert.throws(()=>validateLiveBoardContinuity({...partialBoard(),coreStatus:{ok:true,code:'CORE_TIMEOUT'}},200),/exposed model actions/);
 assert.throws(()=>validateLiveBoardContinuity({ok:false,error:'down'},503),/contract mismatch/);
});

test('hosted observation validation rejects invented coverage counts and model fields',()=>{
 const now=Date.now();
 const snapshot=observedRuntime.buildObservedOddsSnapshot([{
  id:'q',sport:'NBA',league:'NBA',event:'Away @ Home',selection:'Home',market:'h2h',
  sourceProviderId:'espn-core-odds',sourceEventId:'e',sourceBook:'DraftKings',odds:-110,
  startTime:new Date(now+3600000).toISOString(),quoteObservedAt:new Date(now-1000).toISOString(),evidenceClass:'OBSERVED_REFERENCE'
 }],now);
 assert.equal(validateObservedOddsSnapshot(snapshot).referenceCount,1);
 assert.throws(()=>validateObservedOddsSnapshot({...snapshot,referenceQuotes:[{...snapshot.referenceQuotes[0],modelProb:.75}]}),/evidence boundary/);
 assert.throws(()=>validateObservedOddsSnapshot({...snapshot,coverageDetails:{...snapshot.coverageDetails,omittedQuoteCount:4}}),/collection counts/);
 assert.throws(()=>validateObservedOddsSnapshot({...snapshot,coverageDetails:{...snapshot.coverageDetails,sports:[]}}),/sport counts/);
});
