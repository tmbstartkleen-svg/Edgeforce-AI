import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const compiled=ts.transpileModule(fs.readFileSync(new URL('../src/lib/d1-odds-readback-verification.ts',import.meta.url),'utf8'),{
 compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {verifyPreparedOddsReadback}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
const now=Date.parse('2026-10-23T12:00:00Z'),observedAt=now-30000,startsAt='2026-10-23T18:00:00Z';
const value={bookmaker:'DraftKings',sport:'basketball_nba',league:'NBA',marketType:'player_points',
 outcomeId:'Over',playerId:'name:example player',line:'20.5',startsAt,priceAmerican:-115};
const expected={provider:'the-odds-api',upstreamId:'api.the-odds-api.com',eventId:'event1',
 marketId:'player_points',kind:'odds',observedAt,value};
const stored={source_id:expected.provider,upstream_id:expected.upstreamId,event_id:expected.eventId,
 market_id:expected.marketId,observation_kind:'odds',observed_at:new Date(observedAt).toISOString(),payload:JSON.stringify(value)};
test('one exact identity-and-price persisted row gives complete readback, not release certification',()=>{
 const r=verifyPreparedOddsReadback([expected],[stored],now);
 assert.equal(r.exactReadbackComplete,true);
 assert.equal(r.readbackMatches,1);
 assert.equal(r.releaseCertified,false);
});
test('different odds price, player, line, upstream and timestamp cannot be substituted',()=>{
 const variants=[
  {...stored,payload:JSON.stringify({...value,priceAmerican:-110})},
  {...stored,payload:JSON.stringify({...value,playerId:'name:someone else'})},
  {...stored,payload:JSON.stringify({...value,line:'21.5'})},
  {...stored,upstream_id:'unrelated-upstream'},
  {...stored,observed_at:new Date(observedAt+1000).toISOString()}
 ];
 for(const record of variants){
  const r=verifyPreparedOddsReadback([expected],[record],now);
  assert.equal(r.exactReadbackComplete,false);
  assert.equal(r.rejected.EXPECTED_QUOTE_MISSING,1);
 }
});
test('malformed stale and non-odds rows fail closed with distinct reasons',()=>{
 const r=verifyPreparedOddsReadback([expected],[
  {...stored,payload:'not-json'},
  {...stored,observed_at:new Date(now-3600000).toISOString()},
  {...stored,observation_kind:'score'}
 ],now);
 assert.equal(r.exactReadbackComplete,false);
 assert.equal(r.rejected.MALFORMED_STORED_PAYLOAD,1);
 assert.equal(r.rejected.STORED_QUOTE_NOT_FRESH,1);
 assert.equal(r.rejected.NON_ODDS_OR_MISSING_IDENTITY,1);
});
test('duplicate stored quotes are ambiguous, duplicate expected quote IDs are rejected',()=>{
 assert.equal(verifyPreparedOddsReadback([expected],[stored,stored],now).rejected.AMBIGUOUS_STORED_DUPLICATES,1);
 assert.equal(verifyPreparedOddsReadback([expected,expected],[stored],now).rejected.DUPLICATE_EXPECTED_QUOTE,1);
 assert.equal(verifyPreparedOddsReadback([],[stored],now).exactReadbackComplete,false);
 assert.throws(()=>verifyPreparedOddsReadback(Array(26).fill(expected),[],now),/INVALID_ODDS_READBACK_LIMIT/);
});
