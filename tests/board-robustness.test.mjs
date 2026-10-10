import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';

const engine=readFileSync(new URL('../src/lib/boardRobustness.ts',import.meta.url),'utf8');
const dashboard=readFileSync(new URL('../src/components/Dashboard.tsx',import.meta.url),'utf8');

test('V120 inline robustness uses existing board evidence only',()=>{
 assert.match(engine,/buildBoardRobustness/);
 assert.match(engine,/edgeBuffer/);
 assert.match(engine,/dynamicConfidence/);
 assert.match(engine,/simCi/);
 assert.match(engine,/freshness/);
 assert.match(engine,/regime/);
 assert.match(engine,/contextQuality/);
 assert.match(engine,/reliabilityMode/);
 assert.match(engine,/consensus/);
 assert.doesNotMatch(engine,/fetch\s*\(/);
 assert.doesNotMatch(engine,/ingestOdds|fetchPredictionMarkets|axios|http[s]?:\/\//);
});

test('V120 robustness classifications are explicit and conservative',()=>{
 assert.match(engine,/score>=\.78\?'ROBUST'/);
 assert.match(engine,/score>=\.62\?'RESILIENT'/);
 assert.match(engine,/score>=\.44\?'FRAGILE':'FAIL'/);
 assert.match(engine,/reviewRequired/);
 assert.match(engine,/reliabilityCriticalOpen/);
 assert.match(engine,/stale market data/);
});

test('dashboard exposes robustness filtering without forcing it on',()=>{
 assert.match(dashboard,/robustnessFilter.*useState<'ALL'\|'RESILIENT'\|'ROBUST'>\('ALL'\)/);
 assert.match(dashboard,/V120 robustness/);
 assert.match(dashboard,/Resilient\+/);
 assert.match(dashboard,/Robust only/);
 assert.match(dashboard,/robustnessBadge/);
 assert.match(dashboard,/0 extra calls/);
});


test('V121 robustness-aware ranking is opt-in and zero-call',()=>{
 assert.match(engine,/buildBoardPriority/);
 assert.match(engine,/sim\*\.45\+robustness\.score\*\.35\+confidence\*\.20/);
 assert.match(engine,/reviewPenalty=robustness\.reviewRequired\?\.08:0/);
 assert.doesNotMatch(engine,/fetch\s*\(/);
 assert.match(dashboard,/rankingMode.*useState<'SIM'\|'PRIORITY'>\('SIM'\)/);
 assert.match(dashboard,/V121 ranking/);
 assert.match(dashboard,/Highest simulation/);
 assert.match(dashboard,/Robustness-aware/);
 assert.match(dashboard,/rankedFiltered/);
});


test('V125 priority explainability stays local and deterministic',()=>{
 assert.match(engine,/explanation:string\[\]/);
 assert.match(engine,/review penalty/);
 assert.match(engine,/robustness\.reasons\.slice\(0,2\)/);
 assert.doesNotMatch(engine,/fetch\s*\(/);
 assert.match(dashboard,/buildBoardPriority\(x\)\.explanation\.slice\(0,3\)/);
});


test('V126 ranking divergence compares priority and simulation locally',()=>{
 assert.match(engine,/buildBoardRankDeltas/);
 assert.match(engine,/label=delta>=3\?'UPGRADED':delta<=-3\?'DOWNGRADED':'STABLE'/);
 assert.doesNotMatch(engine,/fetch\s*\(/);
 assert.match(dashboard,/rankDeltas/);
 assert.match(dashboard,/V126/);
 assert.match(dashboard,/place/);
});
