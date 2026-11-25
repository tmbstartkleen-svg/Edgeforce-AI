import assert from 'node:assert/strict';
import test from 'node:test';
import {loadProvider} from './helpers/load-provider.mjs';

const approvedUrl='https://review-source.example/markets';
const reviewSlot={
 id:'odds-provider-primary',name:'Review source',url:approvedUrl,capability:'ODDS',
 maxAgeMin:5,priority:80,timeoutMs:1000,apiKey:'fixture-review-key',authScheme:'Bearer'
};
const approvals={
 [reviewSlot.id]:{operator:'approved-operator',origin:new URL(approvedUrl).origin,books:['draftkings']}
};
const nativeAdapters=[
 ['espn-core://odds','espnCoreOdds','fetchEspnCoreOdds'],
 ['therundown://results','theRundownResults','fetchTheRundownResults'],
 ['therundown://pregame-main','theRundown','fetchTheRundownBoard'],
 ['sharp-api://pregame-main','sharpApi','fetchSharpApiBoard'],
 ['propline://player-props','propLine','fetchPropLineBoard'],
 ['odds-api-2://live-board','oddsApi2','fetchOddsApi2Board'],
 ['sports-game-odds://live-board','sportsGameOdds','fetchSportsGameOddsBoard'],
 ['the-odds-api://live-board','theOddsApi','fetchTheOddsApiBoard']
];

function useApprovals(t,value){
 const previous=process.env.ODDS_PRICE_REVIEW_APPROVALS;
 process.env.ODDS_PRICE_REVIEW_APPROVALS=JSON.stringify(value);
 t.after(()=>{
  if(previous===undefined)delete process.env.ODDS_PRICE_REVIEW_APPROVALS;
  else process.env.ODDS_PRICE_REVIEW_APPROVALS=previous;
 });
}

function httpBackend(overrides={}){
 const fail=()=>assert.fail('Unexpected native adapter dispatch');
 const modules=nativeAdapters.map(([,module,name])=>['./'+module,{[name]:overrides[name]??fail}]);
 return loadProvider('http',Object.fromEntries(modules));
}

function certificationBackend(fetchProviderJson){
 return loadProvider('../providerCertification',{
  './db':{db:()=>null},
  './providers/config':{configuredProviders:()=>[]},
  './providers/http':{fetchProviderJson},
  './releaseManifest':{RELEASE:{}},
  './persistence':{latestStoredMarkets:async()=>[]},
  './dataQuality':{auditMarketBatch:()=>({})},
  './providers/fanLineWire':{fetchFanDuelOddsPulse:async()=>null}
 });
}

function completeReviewMarket(){
 const now=Date.now();
 return ['Home','Away'].map(selection=>({
  sport:'Basketball',league:'NBA',home:'Home',away:'Away',sourceEventId:'fixture-1',
  startTime:new Date(now+3600000).toISOString(),market:'moneyline',period:'FULL_GAME',
  settlementKey:'includes-overtime',currency:'USD',venueType:'SPORTSBOOK',bookmaker:'DraftKings',
  outcomeCount:2,selection,sourceTimestamp:new Date(now-1000).toISOString(),status:'OPEN',odds:-110
 }));
}

test('review-only slots with native routing aliases are rejected before adapter or HTTP dispatch',async t=>{
 useApprovals(t,approvals);
 t.mock.method(globalThis,'fetch',async()=>assert.fail('Unexpected HTTP dispatch'));
 const {fetchProviderJson}=httpBackend();
 for(const [url] of nativeAdapters){
  const result=await fetchProviderJson({...reviewSlot,url});
  assert.equal(result.ok,false,url);
  assert.equal(result.status,undefined);
  assert.equal(result.data,undefined);
  assert.match(result.error,/approval is missing or invalid/);
 }
 const mismatchedOrigin=await fetchProviderJson({...reviewSlot,url:'https://other.example/markets'});
 assert.equal(mismatchedOrigin.ok,false);
 assert.match(mismatchedOrigin.error,/approval is missing or invalid/);
});

test('approved HTTPS review fetch preserves auth, rejects redirects, and keeps native adapter routing intact',async t=>{
 useApprovals(t,approvals);
 const rows=completeReviewMarket();
 const transport=t.mock.method(globalThis,'fetch',async(url,options)=>{
  assert.equal(url,approvedUrl);
  assert.equal(options.headers.Authorization,'Bearer fixture-review-key');
  assert.equal(options.redirect,'error');
  return Response.json({markets:rows});
 });
 const adapter=t.mock.fn(async()=>({ok:true,providerId:'sports-game-odds',data:[]}));
 const {fetchProviderJson}=httpBackend({fetchSportsGameOddsBoard:adapter});
 const approved=await fetchProviderJson(reviewSlot);
 assert.equal(approved.ok,true);
 assert.deepEqual(approved.data,{markets:rows});
 const native=await fetchProviderJson({...reviewSlot,id:'sports-game-odds',url:'sports-game-odds://live-board'});
 assert.equal(native.ok,true);
 assert.equal(native.providerId,'sports-game-odds');
 assert.equal(transport.mock.callCount(),1);
 assert.equal(adapter.mock.callCount(),1);
});

test('certification rejects review slots without an applicable approval before requesting provider data',async t=>{
 useApprovals(t,approvals);
 const provider=t.mock.fn(async()=>({ok:true,status:200,latencyMs:1,data:completeReviewMarket()}));
 const {certifyProvider,evaluateCertificationResults}=certificationBackend(provider);
 for(const config of [
  {...reviewSlot,url:'sports-game-odds://live-board'},
  {...reviewSlot,id:'odds-provider-secondary'}
 ]){
  const result=await certifyProvider(config);
  assert.equal(result.status,'FAILED');
  assert.equal(result.normalizedCount,0);
  assert.equal(result.httpStatus,undefined);
  assert.match(result.error,/approval is missing or invalid/);
  assert.equal(evaluateCertificationResults([result]).launchReady,false);
 }
 assert.equal(provider.mock.callCount(),0);
});

test('a complete and current approved review-slot response remains outside launch certification',async t=>{
 useApprovals(t,approvals);
 const provider=t.mock.fn(async()=>({ok:true,status:200,latencyMs:1,data:{markets:completeReviewMarket()}}));
 const {certifyProvider,evaluateCertificationResults}=certificationBackend(provider);
 const result=await certifyProvider(reviewSlot);
 assert.equal(result.status,'CAUTION');
 assert.equal(result.rowCount,2);
 assert.equal(result.normalizedCount,0);
 assert.equal(result.httpStatus,200);
 assert.equal(evaluateCertificationResults([result]).launchReady,false);
 assert.equal(provider.mock.callCount(),1);
});

test('a generic odds slot cannot invoke a native alias even before review configuration exists',async t=>{
 const previous=process.env.ODDS_PRICE_REVIEW_APPROVALS;
 delete process.env.ODDS_PRICE_REVIEW_APPROVALS;
 t.after(()=>{if(previous!==undefined)process.env.ODDS_PRICE_REVIEW_APPROVALS=previous;});
 t.mock.method(globalThis,'fetch',async()=>assert.fail('Unexpected HTTP dispatch'));
 const result=await httpBackend().fetchProviderJson({...reviewSlot,url:'sports-game-odds://live-board'});
 assert.equal(result.ok,false);
 assert.match(result.error,/Generic odds feeds require an HTTP or HTTPS endpoint/);
});
