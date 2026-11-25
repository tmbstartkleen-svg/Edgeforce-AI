import assert from 'node:assert/strict';
import test from 'node:test';
import {loadProvider} from './helpers/load-provider.mjs';

const config={id:'the-odds-api',name:'The Odds API',url:'the-odds-api://live-board',capability:'ODDS',
 priority:1,enabled:true,timeoutMs:6500,maxAgeMin:20,marketRole:'PUBLIC',consensusWeight:1};
const diagnostics={schemaVersion:1,cacheHit:false,cacheAgeMs:0,quotaEvidence:'UNAVAILABLE',failureKind:'NETWORK',
 requests:[{stage:'PREFLIGHT',endpoint:'SPORTS_CATALOG',attempted:true,responseReceived:false,
  startedAt:new Date().toISOString(),elapsedMs:12,responseBytes:0,quota:{},failureKind:'NETWORK',failurePhase:'REQUEST',transportCode:'ECONNRESET'}]};
const failed={ok:false,providerId:config.id,providerName:config.name,capability:'ODDS',latencyMs:12,status:502,
 receivedAt:new Date().toISOString(),error:'The Odds API quota preflight network request failed',diagnostics};
const certification=()=>loadProvider('../providerCertification',{
 './db':{db:()=>null},'./providers/config':{configuredProviders:()=>[config]},
 './providers/http':{fetchProviderJson:async()=>failed},'./releaseManifest':{RELEASE:{}},
 './persistence':{latestStoredMarkets:async()=>[]},'./dataQuality':{auditMarketBatch:()=>({})},
 './providers/fanLineWire':{fetchFanDuelOddsPulse:async()=>null}
});

test('provider HTTP adapter preserves redacted diagnostics and distinguishes transport failure from exhaustion',async()=>{
 const unused=()=>{throw new Error('unrelated provider called')};
 const {fetchProviderJson}=loadProvider('http',{
  './theOddsApi':{fetchTheOddsApiBoard:async()=>({...failed,data:[],quota:{},warnings:[],attempts:[],retryAfterMs:60000})},
  './sportsGameOdds':{fetchSportsGameOddsBoard:unused},'./sharpApi':{fetchSharpApiBoard:unused},
  './propLine':{fetchPropLineBoard:unused},'./oddsApi2':{fetchOddsApi2Board:unused},
  './theRundown':{fetchTheRundownBoard:unused},'./theRundownResults':{fetchTheRundownResults:unused},
  './espnCoreOdds':{fetchEspnCoreOdds:unused}
 });
 const result=await fetchProviderJson(config);
 assert.deepEqual(result.diagnostics,diagnostics);
 assert.equal(result.retryAfterMs,60000);
 assert.equal(result.diagnostics.requests[0].httpStatus,undefined);
});

test('certification preserves request evidence without inventing an HTTP response',async()=>{
 const {certifyProvider,evaluateCertificationResults}=certification();
 const result=await certifyProvider(config);
 assert.equal(result.status,'FAILED');
 assert.equal(result.httpStatus,undefined);
 assert.deepEqual(result.diagnostics,diagnostics);
 assert.equal(evaluateCertificationResults([result]).launchReady,false);
});

test('odds-panel failures retain structured diagnostic evidence for dashboard and status consumers',async()=>{
 const {fetchNormalizedOdds}=loadProvider('odds',{
  './config':{configuredProviders:()=>[config]},'./http':{fetchProviderJson:async()=>failed},
  './healthStore':{loadProviderHealthStates:async()=>new Map(),recordProviderResult:async()=>{}},
  '../marketConsensus':{buildConsensusMarkets:()=>{throw new Error('failed provider entered consensus')}}
 });
 const result=await fetchNormalizedOdds();
 assert.equal(result.markets.length,0);
 assert.deepEqual(result.attempts[0].diagnostics,diagnostics);
});

test('credit continuity uses explicit failure evidence instead of matching the word quota in a transport error',()=>{
 const {providerHasCreditBlock}=certification();
 const provider={capability:'ODDS',status:'FAILED',reasons:[],error:failed.error,diagnostics};
 assert.equal(providerHasCreditBlock(provider),false);
 assert.equal(providerHasCreditBlock({...provider,diagnostics:undefined}),false);
 assert.equal(providerHasCreditBlock({...provider,diagnostics:{...diagnostics,failureKind:'CREDIT_RESERVE'}}),true);
 assert.equal(providerHasCreditBlock({...provider,diagnostics:{...diagnostics,failureKind:'QUOTA_UNVERIFIED'}}),true);
 assert.equal(providerHasCreditBlock({...provider,diagnostics:{...diagnostics,failureKind:'QUOTA_EXHAUSTED'}}),true);
 assert.equal(providerHasCreditBlock({...provider,diagnostics:undefined,error:'remaining=12'}),false);
 assert.equal(providerHasCreditBlock({...provider,diagnostics:undefined,error:'OUT_OF_USAGE_CREDITS'}),true);
});
