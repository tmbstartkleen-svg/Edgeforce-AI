import test from 'node:test';
import assert from 'node:assert/strict';
import {AGENTS,planAgentRuns,normalizeObservation,classifyFreshness,sourceCoverage} from '../src/lib/intelligence-core/agent-planner.mjs';

test('plans bounded agents by priority and budget',()=>{
 const p=planAgentRuns({now:1_000_000,activeEvent:true,availableBudget:3,maxTasks:2});
 assert.equal(p.tasks.length,2);
 assert.deepEqual(p.tasks.map(x=>x.agentId),['live-games','data-quality']);
 assert.equal(p.remainingBudget,1);
});
test('respects cooldowns, circuits, and last run',()=>{
 const p=planAgentRuns({now:1_000_000,availableBudget:20,maxTasks:20,
   lastRuns:{'live-games':999999},circuitOpen:['sportsbook-odds'],
   cooldowns:{'data-quality':1_500_000}});
 assert.ok(!p.tasks.some(x=>['live-games','sportsbook-odds','data-quality'].includes(x.agentId)));
});
test('supports opt-in adapter availability',()=>{
 const p=planAgentRuns({now:1_000_000,supported:['injuries-lineups'],availableBudget:5});
 assert.deepEqual(p.tasks.map(x=>x.agentId),['injuries-lineups']);
});
test('observations retain provenance and do not invent independence',()=>{
 const input={provider:'aggregate',upstreamId:'provider-A',eventId:'game',kind:'odds',observedAt:1000,value:{book:'DK'}};
 const o=normalizeObservation(input,2000);
 assert.equal(o.sourceClass,'EXTERNAL_OBSERVATION');
 assert.equal(classifyFreshness({observedAt:1000,now:2000,maxAgeMs:100}), 'STALE');
 assert.equal(sourceCoverage([o,{...o,value:{book:'FD'}}]).crossProviderVerified,false);
 assert.equal(sourceCoverage([o,{...o,upstreamId:'provider-B'}]).crossProviderVerified,true);
});
test('rejects invalid or future observations',()=>{
 assert.throws(()=>normalizeObservation({provider:'x',upstreamId:'x',eventId:'x',kind:'odds',observedAt:100000},1000));
});
