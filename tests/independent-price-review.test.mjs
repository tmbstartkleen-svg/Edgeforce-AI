import assert from 'node:assert/strict';
import test from 'node:test';
import {loadProvider} from './helpers/load-provider.mjs';

const {priceReviewApproval,normalizePriceReviewSource,buildPriceReview}=loadProvider('priceReview');
const now=Date.parse('2026-11-25T12:00:00Z');
const iso=offset=>new Date(now+offset).toISOString();
const configs=['primary','secondary','tertiary'].map((slot,index)=>({
 id:'odds-provider-'+slot,name:'Feed '+slot,url:`https://provider-${index}.example/quotes`,
 capability:'ODDS',maxAgeMin:10,timeoutMs:1000,consensusWeight:1
}));
const approved=Object.fromEntries(configs.map((c,i)=>[c.id,{operator:'operator-'+i,origin:new URL(c.url).origin,
 books:i===0?['draftkings']:i===1?['fanduel']:['betmgm']}]));
const approval=(index,overrides={})=>priceReviewApproval(configs[index],JSON.stringify({...approved,
 [configs[index].id]:{...approved[configs[index].id],...overrides}}));
const books=['DraftKings','FanDuel','BetMGM'];
const sourceRows=(i,changes={})=>['Home Team','Away Team'].map((selection,index)=>({
 sourceEventId:'event-'+i,sport:'Basketball',league:'NBA',home:'Home Team',away:'Away Team',
 startTime:iso(3600000),market:'moneyline',period:'FULL_GAME',settlementKey:'includes-overtime',
 currency:'USD',outcomeCount:2,venueType:'SPORTSBOOK',bookmaker:books[i],
 selection,odds:index===0?-110:105,sourceTimestamp:iso(-60000),status:'OPEN',...changes
}));
const source=(i,rows=sourceRows(i),allowed=approval(i))=>normalizePriceReviewSource({markets:rows},configs[i].id,allowed,now);
const review=(...sources)=>buildPriceReview(3,sources,now);

test('approvals are operator-supplied, scoped to exact HTTPS origins and supported sportsbooks',()=>{
 assert.ok(approval(0));
 for(const bad of [{origin:'https://wrong.example'},{operator:''},{books:['kalshi']},{books:['DraftKings']}])assert.equal(approval(0,bad),undefined);
 assert.equal(priceReviewApproval({...configs[0],url:'http://provider-0.example/quotes'},JSON.stringify(approved)),undefined);
 assert.equal(priceReviewApproval({...configs[0],id:'espn-core-odds'},JSON.stringify(approved)),undefined);
 assert.equal(priceReviewApproval(configs[0],'{'),undefined);
});

test('two separately authorized books match on the exact market and retain their own source event identities',()=>{
 const result=review(source(0),source(1,sourceRows(1,{startTime:'2026-11-25T08:00:00-05:00',home:'HOME TEAM',sourceTimestamp:iso(-20000)})));
 assert.equal(result.status,'CORROBORATED');
 assert.equal(result.respondedFeeds,2);
 assert.equal(result.eligibleBookMarkets,2);
 assert.equal(result.corroboratedMarkets,1);
 const [market]=result.markets;
 assert.equal(market.expiresAt,iso(240000));
 assert.deepEqual(market.sources.map(x=>[x.bookmaker,x.sourceEventId,x.sourceUpdatedAt]),[
  ['DraftKings','event-0',iso(-60000)],['FanDuel','event-1',iso(-20000)]
 ]);
 assert.equal(result.recommendationsAuthorized,false);
 assert.doesNotMatch(JSON.stringify(result),/modelProb|expectedValue|stake|provider-0\.example/);
});

test('failed or unmatched sources cannot erase complete evidence from other sources or manufacture a match',()=>{
 const one=review(source(0));
 assert.equal(one.status,'NO_INDEPENDENT_MATCH');
 assert.equal(one.eligibleBookMarkets,1);
 assert.equal(one.markets.length,0);
 assert.equal(buildPriceReview(2,[],now).status,'APPROVED_FEEDS_UNAVAILABLE');
 assert.equal(buildPriceReview(0,[],now).status,'NO_APPROVED_FEEDS');
 const a=source(0);
 const sameOwner=source(1,sourceRows(1),approval(1,{operator:'operator-0'}));
 const sameHost=source(1,sourceRows(1),{...approval(1),host:approval(0).host});
 const sameBook=source(1,sourceRows(1,{bookmaker:'DraftKings'}),approval(1,{books:['draftkings']}));
 const skewed=source(1,sourceRows(1,{sourceTimestamp:iso(-181000)}));
 for(const b of [sameOwner,sameHost,sameBook,skewed])assert.equal(review(a,b).corroboratedMarkets,0);
 assert.equal(review(a,sameOwner,source(2)).corroboratedMarkets,1);
});

test('event orientation, league, scheduled time, settlement and spread line must match',()=>{
 for(const changes of [{league:'Other League'},{startTime:iso(3601000)},{settlementKey:'regulation-only'},
  {home:'Away Team',away:'Home Team'}]){
  assert.equal(review(source(0),source(1,sourceRows(1,changes))).corroboratedMarkets,0);
 }
 const spread=(index,line)=>source(index,sourceRows(index,{market:'spread',line}));
 assert.equal(review(spread(0,-2.5),spread(1,-2.5)).corroboratedMarkets,1);
 assert.equal(review(spread(0,-2.5),spread(1,2.5)).corroboratedMarkets,0);
 const total=(index,line)=>source(index,sourceRows(index,{market:'total',line}).map((row,i)=>({...row,selection:i?'Under':'Over'})));
 assert.equal(review(total(0,210.5),total(1,210.5)).corroboratedMarkets,1);
 assert.equal(review(total(0,210.5),total(1,211.5)).corroboratedMarkets,0);
});

test('inferred, stale, future and invalid timestamps cannot become fresh bookmaker evidence',()=>{
 for(const sourceTimestamp of [undefined,iso(-300000),iso(1),iso(-1000).slice(0,-1),'2026-02-30T04:00:00Z']){
  const filtered=source(0,sourceRows(0,{sourceTimestamp,pulledAt:iso(0),updatedAt:iso(0)}));
  assert.equal(filtered.eligibleMarkets.length,0,String(sourceTimestamp));
 }
 for(const override of [{evidenceClass:'OBSERVED_REFERENCE'},{liveEligible:false},{venueType:'PREDICTION_MARKET'},
  {startTime:iso(0)},{bookmaker:'FanDuel'},{odds:99},{odds:100.1},{outcomeCount:3}]){
  assert.equal(source(0,sourceRows(0,override)).eligibleMarkets.length,0,JSON.stringify(override));
 }
 const nearStart=sourceRows(0,{startTime:iso(1000)});
 const pair=[source(0,nearStart),source(1,sourceRows(1,{startTime:iso(1000)}))];
 assert.equal(review(...pair).markets[0].expiresAt,iso(1000));
 assert.equal(buildPriceReview(2,pair,now+1000).corroboratedMarkets,0);
});

test('corrections and suspensions replace old prices and ambiguous source event IDs are withheld',()=>{
 const old=sourceRows(0),newAt=iso(-30000);
 for(const changed of [[{...old[0],sourceTimestamp:newAt}],
  [{...old[0],sourceTimestamp:newAt,status:'SUSPENDED'}],
  [{...old[0],odds:120}],[{...old[0],sourceTimestamp:'broken'}],
  [{...old[0],sourceEventId:'ambiguous'}]]){
  assert.equal(source(0,[...old,...changed]).eligibleMarkets.length,0);
 }
 assert.equal(source(0,[...old,...old]).eligibleMarkets.length,1);
 const newRows=old.map(row=>({...row,sourceTimestamp:newAt,odds:115}));
 assert.equal(source(0,[...old,...newRows]).eligibleMarkets[0].quotes[0].americanOdds,115);
 const twoFixtures=[...old,...sourceRows(0,{startTime:iso(7200000)})];
 assert.equal(source(0,twoFixtures).eligibleMarkets.length,0);
});

test('conflicting same-time prices at a book cannot corroborate another book',()=>{
 const duplicate=source(2,sourceRows(2,{bookmaker:'DraftKings',odds:120}),approval(2,{books:['draftkings']}));
 const outcome=review(source(0),source(1),duplicate);
 assert.equal(outcome.corroboratedMarkets,0);
 assert.equal(outcome.rejections.BOOKMAKER_PRICE_CONFLICT,1);
});

test('oversize or invalid input fails closed with bounded diagnostics',()=>{
 const over=source(0,Array(4001).fill(sourceRows(0)[0]));
 assert.equal(over.rowsExamined,0);
 assert.equal(over.truncated,true);
 assert.equal(review(over,source(1)).inputTruncated,true);
 assert.equal(normalizePriceReviewSource({rows:[]},configs[0].id,approval(0),now).rejections.INVALID_FEED_CONTRACT,1);
});

test('approved feed integration preserves matching quotes when one feed fails and excludes them from modeling',async t=>{
 t.mock.method(Date,'now',()=>now);
 const original=process.env.ODDS_PRICE_REVIEW_APPROVALS;
 process.env.ODDS_PRICE_REVIEW_APPROVALS=JSON.stringify(approved);
 t.after(()=>{ if(original===undefined)delete process.env.ODDS_PRICE_REVIEW_APPROVALS; else process.env.ODDS_PRICE_REVIEW_APPROVALS=original; });
 const {fetchNormalizedOdds}=loadProvider('odds',{
  './config':{configuredProviders:()=>configs},
  './http':{fetchProviderJson:async config=>{
   const index=configs.indexOf(config);
   if(index===2)throw new Error('provider timed out');
   return {ok:true,data:sourceRows(index),latencyMs:10};
  }},
  './healthStore':{loadProviderHealthStates:async()=>new Map(),recordProviderResult:async()=>{}},
  '../marketConsensus':{buildConsensusMarkets:()=>assert.fail('price-review quotes entered consensus')}
 });
 const result=await fetchNormalizedOdds();
 assert.deepEqual(result.markets,[]);
 assert.deepEqual(result.panelMarkets,[]);
 assert.equal(result.priceReview.corroboratedMarkets,1);
 assert.equal(result.priceReview.respondedFeeds,2);
 assert.equal(result.attempts[2].ok,false);
 assert.equal(result.attempts[0].reviewBookMarkets,1);
});

test('misconfigured approval blocks generic HTTP before dispatch',async t=>{
 const original=process.env.ODDS_PRICE_REVIEW_APPROVALS;
 process.env.ODDS_PRICE_REVIEW_APPROVALS='{';
 t.after(()=>{ if(original===undefined)delete process.env.ODDS_PRICE_REVIEW_APPROVALS; else process.env.ODDS_PRICE_REVIEW_APPROVALS=original; });
 t.mock.method(globalThis,'fetch',async()=>assert.fail('unapproved endpoint requested'));
 const unused=()=>assert.fail('native adapter called');
 const {fetchProviderJson}=loadProvider('http',Object.fromEntries([
  ['theOddsApi','fetchTheOddsApiBoard'],['sportsGameOdds','fetchSportsGameOddsBoard'],['sharpApi','fetchSharpApiBoard'],
  ['propLine','fetchPropLineBoard'],['oddsApi2','fetchOddsApi2Board'],['theRundown','fetchTheRundownBoard'],
  ['theRundownResults','fetchTheRundownResults'],['espnCoreOdds','fetchEspnCoreOdds']
 ].map(([module,name])=>['./'+module,{[name]:unused}])));
 assert.match((await fetchProviderJson(configs[0])).error,/approval is missing or invalid/);
});

test('a newer withdrawal for the same sportsbook suppresses a lagging syndicated copy',()=>{
 const withdrawal=source(2,sourceRows(2,{bookmaker:'DraftKings',sourceTimestamp:iso(-10000),status:'SUSPENDED'}),
  approval(2,{books:['draftkings']}));
 const outcome=review(source(0),source(1),withdrawal);
 assert.equal(outcome.corroboratedMarkets,0);
 assert.equal(outcome.rejections.BOOKMAKER_REVISION_WITHHELD,1);
});

test('pilot approval scopes all configured feeds to one exact sport and league',()=>{
 const pilotScope={sport:' BASKETBALL ',league:'NBA'};
 const config=priceReviewApproval(configs[0],JSON.stringify({...approved,pilotScope}));
 assert.deepEqual(config.pilotScope,{sport:'basketball',league:'nba'});
 const rows=[...sourceRows(0),...sourceRows(0,{league:'NCAAB',sourceEventId:'college'})];
 const result=source(0,rows,config);
 assert.equal(result.rejections.OUTSIDE_PILOT_SCOPE,2);
 assert.equal(result.eligibleMarkets.length,1);
 assert.equal(priceReviewApproval(configs[0],JSON.stringify({...approved,pilotScope:{sport:'basketball'}})),undefined);
 assert.equal(priceReviewApproval(configs[0],JSON.stringify({...approved,pilotScope:null})),undefined);
});

test('a withdrawal survives an author outage and only a later revision can reopen the book',()=>{
 const tracker=loadProvider('priceReview').createPriceReviewTracker();
 const older=source(0), foil=source(1);
 const copyApproval=approval(2,{books:['draftkings']});
 const timestamp=iso(-10000);
 const withdrawal=source(2,sourceRows(2,{bookmaker:'DraftKings',status:'SUSPENDED',sourceTimestamp:timestamp}),copyApproval);
 assert.equal(tracker.build(3,[older,foil],now).corroboratedMarkets,1);
 assert.equal(tracker.build(3,[older,foil,withdrawal],now+1000).corroboratedMarkets,0);
 const unavailable=tracker.build(3,[older,foil],now+2000);
 assert.equal(unavailable.respondedFeeds,2);
 assert.equal(unavailable.rejections.BOOKMAKER_REVISION_WITHHELD,1);
 assert.equal(unavailable.corroboratedMarkets,0);
 const atSameTime=source(0,sourceRows(0,{sourceTimestamp:timestamp}));
 assert.equal(tracker.build(3,[atSameTime,foil],now+3000).corroboratedMarkets,0);
 const reopened=source(0,sourceRows(0,{sourceTimestamp:iso(-9000)}));
 assert.equal(tracker.build(3,[reopened,foil],now+4000).corroboratedMarkets,1);
});

test('the newest sportsbook revision fences older copies across outcome shapes and per-feed freshness limits',()=>{
 const drawRows=i=>[...sourceRows(i,{outcomeCount:3}),sourceRows(i,{outcomeCount:3,selection:'Draw',odds:250})[0]];
 const copyApproval={...approval(2,{books:['draftkings']}),maxAgeMs:1000};
 const newer=source(2,sourceRows(2,{bookmaker:'DraftKings',sourceTimestamp:iso(-10000)}),copyApproval);
 assert.equal(newer.eligibleMarkets.length,0);
 assert.equal(newer.rejections.BOOK_UPDATE_EXPIRED,1);
 const outcome=review(source(0,drawRows(0)),source(1,drawRows(1)),newer);
 assert.equal(outcome.rejections.BOOKMAKER_REVISION_WITHHELD,1);
 assert.equal(outcome.eligibleBookMarkets,1);
 assert.equal(outcome.corroboratedMarkets,0);
});

test('a same-time price conflict remains withheld even after the conflicting feed is unavailable',()=>{
 const tracker=loadProvider('priceReview').createPriceReviewTracker();
 const duplicate=source(2,sourceRows(2,{bookmaker:'DraftKings',odds:120}),approval(2,{books:['draftkings']}));
 const active=[source(0),source(1)];
 assert.equal(tracker.build(3,[...active,duplicate],now).rejections.BOOKMAKER_PRICE_CONFLICT,1);
 const next=tracker.build(3,active,now+1000);
 assert.equal(next.rejections.BOOKMAKER_PRICE_CONFLICT,1);
 assert.equal(next.corroboratedMarkets,0);
});

test('a cached publication removes exact expiries and retains another independent pair when available',()=>{
 const tracker=loadProvider('priceReview').createPriceReviewTracker();
 const short=source(0,sourceRows(0),{...approval(0),maxAgeMs:61000});
 const snapshot=tracker.capture(3,[short,source(1),source(2)],now);
 assert.equal(snapshot.read(now).markets[0].sources.length,3);
 const later=snapshot.read(now+1000);
 assert.equal(later.markets[0].sources.length,2);
 assert.equal(later.rejections.EXPIRED_BEFORE_PUBLICATION,1);
 assert.ok(later.markets[0].sources.every(s=>s.bookmaker!=='DraftKings'));
 const expired=snapshot.read(now+240000);
 assert.equal(expired.corroboratedMarkets,0);
 assert.equal(expired.eligibleBookMarkets,0);
 assert.equal(expired.status,'NO_ELIGIBLE_MARKETS');
 assert.equal(snapshot.read(now+1000),expired,'clock rollback cannot revive expired evidence');
});

test('unparseable and oversized payloads are reported but do not count as responding feeds',()=>{
 const invalid=normalizePriceReviewSource({prices:[]},configs[0].id,approval(0),now);
 const oversized=source(1,Array(4001).fill(sourceRows(1)[0]));
 const result=review(invalid,oversized);
 assert.equal(result.respondedFeeds,0);
 assert.equal(result.status,'APPROVED_FEEDS_UNAVAILABLE');
 assert.equal(result.inputTruncated,true);
 assert.equal(result.rejections.INVALID_FEED_CONTRACT,1);
});

test('revision history fails closed on capacity rather than dropping a protective entry',()=>{
 const tracker=loadProvider('priceReview').createPriceReviewTracker(2);
 const pair=[source(0),source(1)];
 const overflow=tracker.build(3,[...pair,source(2)],now);
 assert.equal(overflow.corroboratedMarkets,0);
 assert.equal(overflow.rejections.REVISION_HISTORY_CAPACITY,1);
 assert.equal(tracker.build(2,pair,now+239999).corroboratedMarkets,0);
 const at=now+250000;
 const fresh=configs.slice(0,2).map((c,i)=>normalizePriceReviewSource(
  sourceRows(i,{sourceTimestamp:new Date(at-1000).toISOString()}),c.id,approval(i),at));
 assert.equal(tracker.build(2,fresh,at).corroboratedMarkets,1);
});

test('cached odds responses publish expiry without making new provider requests',async t=>{
 let clock=now;
 t.mock.method(Date,'now',()=>clock);
 const original=process.env.ODDS_PRICE_REVIEW_APPROVALS;
 process.env.ODDS_PRICE_REVIEW_APPROVALS=JSON.stringify(approved);
 t.after(()=>{ if(original===undefined)delete process.env.ODDS_PRICE_REVIEW_APPROVALS; else process.env.ODDS_PRICE_REVIEW_APPROVALS=original; });
 let calls=0;
 const {fetchNormalizedOdds}=loadProvider('odds',{
  './config':{configuredProviders:()=>configs.slice(0,2)},
  './http':{fetchProviderJson:async config=>{
   calls++;
   return {ok:true,data:sourceRows(configs.indexOf(config),{sourceTimestamp:iso(-299000)}),latencyMs:10};
  }},
  './healthStore':{loadProviderHealthStates:async()=>new Map(),recordProviderResult:async()=>{}},
  '../marketConsensus':{buildConsensusMarkets:()=>assert.fail('price-review quotes entered consensus')}
 });
 const initial=await fetchNormalizedOdds();
 assert.equal(initial.priceReview.corroboratedMarkets,1);
 clock+=1000;
 const published=await fetchNormalizedOdds();
 assert.equal(published.priceReview.corroboratedMarkets,0);
 assert.equal(initial.readPriceReview().corroboratedMarkets,0);
 assert.equal(calls,2);
});
