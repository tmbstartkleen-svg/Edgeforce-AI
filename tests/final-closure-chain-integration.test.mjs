import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';

const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const closure=read('src/lib/finalProductionClosure.ts');
const diagnostics=read('src/lib/finalClosureDiagnostics.ts');
const route=read('src/app/api/release/final-closure/route.ts');
const panel=read('src/components/FinalProductionClosurePanel.tsx');

test('V179 closure persistence serializes same-commit attempts before append',()=>{
 assert.match(closure,/pg_advisory_xact_lock\(hashtext\(\$\{lockKey\}\)::bigint\)/);
 assert.match(closure,/select evidence[\s\S]*for update/);
 assert.match(closure,/appendClosureCertificate\(existing\?\.evidence\|\|\{\},report\)/);
 assert.match(closure,/certificateHead:chained\.head/);
 assert.match(closure,/certificateCount:chained\.count/);
});

test('V179 diagnostics independently verify certificate chain',()=>{
 assert.match(diagnostics,/verifyClosureEvidenceChain/);
 assert.match(diagnostics,/CLOSURE_CERTIFICATE_CHAIN_INVALID/);
 assert.match(diagnostics,/&&certificateChain\.valid/);
 assert.match(diagnostics,/certificateChain,/);
});

test('V179 final closure API awaits verified diagnostics after persistence',()=>{
 assert.match(route,/diagnostics:await buildFinalClosureDiagnostics\(latest\)/);
 assert.match(route,/const latest=await latestFinalProductionClosure\(\)/);
 assert.match(route,/diagnostics:await buildFinalClosureDiagnostics\(latest\|\|report\)/);
});

test('V179 operator panel surfaces chain status and attempt count',()=>{
 assert.match(panel,/CERT CHAIN/);
 assert.match(panel,/certificateChain/);
 assert.match(panel,/chainCount/);
 assert.match(panel,/closure certificate chain verifies end to end/);
});
