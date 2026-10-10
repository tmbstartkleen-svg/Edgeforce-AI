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
