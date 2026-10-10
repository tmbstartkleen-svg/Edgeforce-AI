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


test('V127 divergence summary stays local and zero-call',()=>{
 assert.match(engine,/summarizeBoardRankDeltas/);
 assert.match(engine,/upgraded/);
 assert.match(engine,/downgraded/);
 assert.match(engine,/stable/);
 assert.doesNotMatch(engine,/fetch\s*\(/);
 assert.match(dashboard,/V127 DIVERGENCE/);
 assert.match(dashboard,/rankDeltaSummary/);
});


test('V129 movement filter is opt-in and local',()=>{
 assert.match(dashboard,/divergenceFilter/);
 assert.match(dashboard,/V129 movement/);
 assert.match(dashboard,/Upgraded only/);
 assert.match(dashboard,/Downgraded only/);
 assert.match(dashboard,/Stable only/);
 assert.match(dashboard,/divergenceFilter==='ALL'\|\|rankDeltas\.get\(row\.id\)\?\.label===divergenceFilter/);
});


test('V181 review queue isolates fragile or downgraded rows locally',()=>{
 assert.match(dashboard,/reviewQueueOnly/);
 assert.match(dashboard,/setReviewQueueOnly/);
 assert.match(dashboard,/buildBoardRobustness\(row\)\.reviewRequired\|\|rankDeltas\.get\(row\.id\)\?\.label==='DOWNGRADED'/);
});


test('V182 review queue summary is local and one-click',()=>{
 assert.match(dashboard,/reviewQueueSummary/);
 assert.match(dashboard,/V182 review queue/);
 assert.match(dashboard,/V182 REVIEW QUEUE/);
 assert.match(dashboard,/Review \{reviewQueueSummary\.total\}/);
 assert.match(dashboard,/fragile/);
 assert.match(dashboard,/downgraded/);
});


test('V183 ranking efficiency caches local priority work',()=>{
 assert.match(engine,/buildBoardPriorityMap/);
 assert.match(engine,/summarizeBoardRankDeltaMap/);
 assert.match(engine,/priorityMap\.get\(b\.id\)\?\.score/);
 assert.doesNotMatch(engine,/sort\(\(a,b\)=>buildBoardPriority\(b\)\.score-buildBoardPriority\(a\)\.score/);
 assert.match(dashboard,/const priorityMap=useMemo/);
 assert.match(dashboard,/summarizeBoardRankDeltaMap\(rankDeltas\)/);
});


test('V184 review rows explain why they need attention',()=>{
 assert.match(dashboard,/reviewReasonMap/);
 assert.match(dashboard,/V184 REVIEW/);
 assert.match(dashboard,/robustness fail/);
 assert.match(dashboard,/fragile robustness/);
 assert.match(dashboard,/priority rank down/);
});
