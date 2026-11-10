import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePersistedQuoteEvidence,analyzePersistedQuoteEvidence} from '../src/lib/intelligence-core/persisted-quote-opportunity-bridge.mjs';
const now=Date.now(),stamp=new Date(now-60000).toISOString(),pulled=new Date(now-30000).toISOString();
const base={bookmaker:'DraftKings',provider:'aggregator',market_key:'full_moneyline',selection_key:'Home',american_odds:150,pulled_at:pulled,
 raw:{sourceEventId:'event1',sourceTimestamp:stamp,upstreamId:'ownerA',settlementKey:'NBA_OT_INCL',outcomeSetType:'TWO_WAY',
  outcomes:['Home','Away'],venueType:'SPORTSBOOK',currency:'USD'}};
test('reject rows missing explicit settlement and upstream ownership',()=>{
 const r=normalizePersistedQuoteEvidence([{...base,raw:{...base.raw,settlementKey:undefined}}],{now});
 assert.equal(r.quotes.length,0);assert.equal(r.rejectedCount,1);
});
test('preserve actual source observation and raw sportsbook identity',()=>{
 const r=normalizePersistedQuoteEvidence([base],{now});assert.equal(r.quotes.length,1);
 assert.equal(r.quotes[0].observedAt,Date.parse(stamp));assert.equal(r.quotes[0].bookmaker,'DraftKings');
 assert.equal(r.quotes[0].upstreamId,'ownerA');
});
test('stored ingestion time is not accepted as fabricated source observation',()=>{
 const r=normalizePersistedQuoteEvidence([{...base,raw:{...base.raw,sourceTimestamp:undefined}}],{now});assert.equal(r.quotes.length,0);
});
test('future provider observations rejected',()=>{
 const r=normalizePersistedQuoteEvidence([{...base,raw:{...base.raw,sourceTimestamp:new Date(now+120000).toISOString()}}],{now});
 assert.equal(r.rejectionReasons.FUTURE_SOURCE_OBSERVATION,1);
});
test('persisted independent sportsbook prices can produce theoretical arbitrage',()=>{
 const other={...base,bookmaker:'FanDuel',provider:'other-provider',selection_key:'Away',raw:{...base.raw,upstreamId:'ownerB'}};
 const r=analyzePersistedQuoteEvidence([base,other],[],{now});
 assert.equal(r.arbitrage.opportunities.length,1);assert.equal(r.arbitrage.opportunities[0].status,'THEORETICAL_ARBITRAGE');
 assert.equal(r.value.results.length,0);assert.equal(r.realOddsFabricated,0);
});
test('preserves exact player, stat, threshold and period evidence from persisted prop quotes',()=>{
 const raw={...base.raw,lineKey:'assists:5.5',lineValue:5.5,periodKey:'full-plus-ot',
  playerId:'fixture-player',statKey:'assists',outcomes:['Over','Under']};
 const row={...base,market_key:'player-assists-over',selection_key:'Over',raw};
 const q=normalizePersistedQuoteEvidence([row],{now}).quotes[0];
 for(const key of ['lineKey','lineValue','periodKey','playerId','statKey'])assert.equal(q[key],raw[key]);
 const other={...row,bookmaker:'fixture-other-book',provider:'other-provider',raw:{...raw,upstreamId:'ownerB'}};
 const forecast={...q,probability:.6,modelType:'CALIBRATED',outOfSampleVerified:true,sourceAudited:true};
 const report=analyzePersistedQuoteEvidence([row,other],[forecast],{now});
 assert.equal(report.value.results.length,1);
 assert.equal(report.value.results[0].status,'CANDIDATE_FOR_FURTHER_REVIEW');
 assert.equal(report.value.results[0].sourceAuthenticityCertified,false);
});
