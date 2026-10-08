import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';

const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const diagnostics=read('src/lib/finalClosureDiagnostics.ts');
const route=read('src/app/api/release/final-closure/route.ts');
const panel=read('src/components/FinalProductionClosurePanel.tsx');

test('V178 diagnostics verifies exact settlement commit and workflow binding',()=>{
 assert.match(diagnostics,/SETTLEMENT_COMMIT_NOT_BOUND/);
 assert.match(diagnostics,/commitBinding:\{/);
 assert.match(diagnostics,/expectedCommit&&observedCommit&&expectedCommit===observedCommit/);
 assert.match(diagnostics,/SETTLEMENT_WORKFLOW_NOT_BOUND/);
 assert.match(diagnostics,/expected===observed/);
 assert.match(diagnostics,/workflowBinding:\{/);
 assert.match(diagnostics,/operatorReady/);
});

test('V177 diagnostics validates settlement identity and fallback evidence',()=>{
 assert.match(diagnostics,/SETTLEMENT_IDENTITY_NOT_CERTIFIED/);
 assert.match(diagnostics,/SETTLEMENT_IDENTITY_COVERAGE_INCOMPLETE/);
 assert.match(diagnostics,/SETTLEMENT_FALLBACK_NOT_CERTIFIED/);
 assert.match(diagnostics,/identityCoverage===1/);
});

test('V177 final closure API exposes diagnostics on reads and writes',()=>{
 assert.match(route,/buildFinalClosureDiagnostics/);
 assert.match(route,/\{ok:true,latest,diagnostics:await buildFinalClosureDiagnostics\(latest\)\}/);
 assert.match(route,/diagnostics:await buildFinalClosureDiagnostics\(latest\|\|report\)/);
});

test('V177 operator panel exposes run binding and anomaly count',()=>{
 assert.match(panel,/V177 PRODUCTION CLOSURE/);
 assert.match(panel,/SHA BOUND/);
 assert.match(panel,/commitBinding/);
 assert.match(panel,/RUN BOUND/);
 assert.match(panel,/expectedRun/);
 assert.match(panel,/observedRun/);
 assert.match(panel,/ANOMALIES/);
 assert.match(panel,/anomalyCount/);
});

test('V177 operator note preserves primary standby and same workflow contract',()=>{
 assert.match(panel,/settlement evidence is bound to the deployed commit and the same deployment workflow run/);
 assert.match(panel,/Standby commit drift is expected until failover/);
});
