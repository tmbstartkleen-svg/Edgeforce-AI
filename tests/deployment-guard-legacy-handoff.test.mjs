import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';

const guard=readFileSync(new URL('../src/lib/deploymentGuard.ts',import.meta.url),'utf8');
const route=readFileSync(new URL('../src/app/api/release/deployment-guard/route.ts',import.meta.url),'utf8');
const workflow=readFileSync(new URL('../.github/workflows/deploy-production.yml',import.meta.url),'utf8');

test('legacy canary requires explicit unavailable telemetry evidence and workflow handoff',()=>{
 assert.match(guard,/legacyTelemetryUnavailable:boolean/);
 assert.match(guard,/options\.legacyHandoff===true/);
 assert.match(guard,/baseline\.legacyTelemetryUnavailable===true/);
 assert.match(guard,/baselineMajor<74/);
 assert.match(guard,/baseline\.ready&&baseline\.productionReady/);
 assert.match(route,/legacyHandoff:body\.legacyHandoff===true/);
 assert.match(workflow,/LEGACY_TELEMETRY_UNAVAILABLE=true/);
 assert.match(workflow,/legacyTelemetryUnavailable:\(\$legacyTelemetryUnavailable=="true"\)/);
 assert.match(workflow,/legacyHandoff:\(\$legacyHandoff=="true"\)/);
});

test('legacy baseline cannot waive exact candidate readiness certification or fresh pulse',()=>{
 assert.match(guard,/legacyCriticalContinuity=[\s\S]*legacyBaseline&&candidate\.observabilityOverall==='CRITICAL'&&candidate\.pulseUsable&&[\s\S]*candidate\.ready&&candidate\.productionReady&&candidate\.certified/);
 assert.match(guard,/legacyProtectiveContinuity=[\s\S]*legacyBaseline&&candidate\.reliabilityMode==='PROTECTIVE'&&candidate\.pulseUsable&&[\s\S]*candidate\.ready&&candidate\.productionReady&&candidate\.certified/);
 assert.match(guard,/candidate release \$\{candidate\.releaseVersion\|\|'unknown'\} does not match expected/);
 assert.match(guard,/candidate does not have a current successful production certification/);
});

test('modern canaries still compare incidents checks automations and reliability normally',()=>{
 assert.match(guard,/if\(!legacyBaseline&&candidate\.actionIncidents>baseline\.actionIncidents\)/);
 assert.match(guard,/if\(!legacyBaseline&&candidate\.criticalChecks>baseline\.criticalChecks\)/);
 assert.match(guard,/if\(!legacyBaseline&&candidate\.automationFailed>baseline\.automationFailed\)/);
 assert.match(guard,/if\(!legacyBaseline&&candidate\.automationStale>baseline\.automationStale\)/);
 assert.match(guard,/if\(!legacyBaseline&&scoreDelta<=-\.12/);
 assert.match(guard,/if\(!legacyBaseline&&reliabilityDelta<=-\.15/);
});

test('legacy handoff keeps an absolute market freshness ceiling',()=>{
 assert.match(guard,/const marketLimit=Math\.max\(60,\(baseline\.latestMarketAgeMin\?\?0\)\+30\)/);
 assert.match(guard,/candidate\.latestMarketAgeMin!==null&&candidate\.latestMarketAgeMin>marketLimit/);
});
