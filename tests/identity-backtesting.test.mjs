import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const ts=createRequire(import.meta.url)('typescript');
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const c=ts.transpileModule(read('../src/lib/identityBacktesting.ts'),{
 compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
assert.equal(c.diagnostics?.length??0,0);
const {evaluateEventIdentity,gradeBacktestSample,summarizeBacktests,normalizedIdentity}=
 await import('data:text/javascript,'+encodeURIComponent(c.outputText));
const event={sport:'NFL',league:'NFL',home:'Buffalo Bills',away:'Miami Dolphins',
 startsAt:'2026-10-10T20:00:00Z',outcomeSport:'NFL',outcomeLeague:'NFL',
 outcomeHome:'Buffalo Bills',outcomeAway:'Miami Dolphins',outcomeAt:'2026-10-10T20:07:00Z'};
const model=(changes={})=>({
 eventId:'fixture-match-1',sport:'NFL',modelVersion:'v210fixture',selection:'Buffalo Bills',
 modelProbability:.75,homeScore:21,awayScore:14,homeName:'Buffalo Bills',
 awayName:'Miami Dolphins',canonicalHomeId:'buffalo-id',canonicalAwayId:'miami-id',
 predictionTime:'2026-10-09T21:00:00Z',scheduledAt:'2026-10-10T20:00:00Z',
 outcomeEvidence:'CROSS_SOURCE_AGREED',upstreamCount:2,...changes
});
test('V210 identity must match exact teams/league and kickoff, never broad fuzzy matching',()=>{
 assert.equal(evaluateEventIdentity(event).match,true);
 assert.equal(evaluateEventIdentity({...event,outcomeAway:'Miami Heat'}).match,false);
 assert.equal(evaluateEventIdentity({...event,outcomeHome:'Miami Dolphins',outcomeAway:'Buffalo Bills'}).match,false);
 assert.equal(evaluateEventIdentity({...event,outcomeLeague:'NCAAF'}).match,false);
 assert.equal(evaluateEventIdentity({...event,outcomeAt:'2026-10-10T20:11:00Z'}).match,false);
 assert.equal(evaluateEventIdentity({...event,outcomeAt:'not a date'}).match,false);
 assert.equal(normalizedIdentity('Buffalo--Bills'),'buffalo bills');
});
test('V210 real pregame h2h forecast grades Brier and log loss without inventing EV',()=>{
 const g=gradeBacktestSample(model());
 assert.equal(g.ok,true);
 assert.equal(g.entry.outcome,1);
 assert.ok(Math.abs(g.entry.brier-.0625)<1e-10);
 assert.ok(Math.abs(g.entry.logLoss-(-Math.log(.75)))<1e-10);
 assert.equal(gradeBacktestSample(model({selection:'Miami Dolphins'})).entry.outcome,0);
});
test('V210 rejects outcome fraud, tied games, ambiguous selections, postgame model and impossible probability',()=>{
 for(const overrides of [
  {outcomeEvidence:'SINGLE_SOURCE'},{outcomeEvidence:'CONFLICTED'},
  {upstreamCount:1},{homeScore:17,awayScore:17},
  {selection:'Player Points Over 1.5'},{selection:'Chiefs'},
  {predictionTime:'2026-10-10T21:00:00Z'},{modelProbability:1},
  {modelProbability:0},{homeScore:-1}
 ])assert.equal(gradeBacktestSample(model(overrides)).ok,false,JSON.stringify(overrides));
});
test('V210 counts only one model sample per event/model and reports honest insufficient calibration',()=>{
 const result=summarizeBacktests([
  model(),model({selection:'Miami Dolphins'}),
  model({eventId:'fixture-2',selection:'Miami Dolphins'}),
  model({eventId:'fixture-3',outcomeEvidence:'SINGLE_SOURCE'})
 ]);
 assert.equal(result.graded,2);
 assert.equal(result.rejected.DUPLICATE_EVENT_MODEL,1);
 assert.equal(result.rejected.INSUFFICIENT_INDEPENDENT_RESULTS,1);
 assert.equal(result.results[0].sampleSize,2);
 assert.equal(result.results[0].quality,'INSUFFICIENT_SAMPLE');
 assert.equal(result.results[0].outOfSampleProven,false);
 assert.equal(result.results[0].tradeApproved,false);
});
test('V210 uses explicit independent upstream ownership, immutable links, private access, and no provider polling',()=>{
 const migration=read('../db/v210.sql');
 const link=read('../src/app/api/network/v1/identity/route.ts');
 const back=read('../src/app/api/network/v1/backtests/route.ts');
 const panel=read('../src/components/SportsIdentityAccuracy.tsx');
 assert.match(migration,/unique\(entity_type,source,source_entity_id\)/);
 assert.match(migration,/independent_source_enabled boolean not null default false/);
 assert.match(migration,/count\(distinct upstream_owner\)/);
 assert.match(migration,/row_number\(\) over/);
 assert.match(link,/authorizeNetwork\(request\)/);
 assert.match(link,/EDGEFORCE_IDENTITY_REVIEW_ENABLED/);
 assert.match(link,/evaluateEventIdentity/);
 assert.match(back,/authorizeNetwork\(request\)/);
 assert.match(back,/from model_runs mr/);
 assert.match(back,/edgeforce_cross_source_finals_v210/);
 assert.match(back,/limit 350/);
 assert.match(panel,/Sports Network/i);
 assert.doesNotMatch(link,/\bfetch\(/);
 assert.doesNotMatch(back,/\bfetch\(/);
 assert.doesNotMatch(panel,/setInterval|localStorage/);
});
