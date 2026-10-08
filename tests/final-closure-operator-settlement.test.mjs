import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';

const closure=readFileSync(new URL('../src/lib/finalProductionClosure.ts',import.meta.url),'utf8');
const panel=readFileSync(new URL('../src/components/FinalProductionClosurePanel.tsx',import.meta.url),'utf8');

test('V175 closure classifies settlement identity strength for operator visibility',()=>{
 assert.match(closure,/const settlementIdentityStrength=/);
 assert.match(closure,/'NOOP'/);
 assert.match(closure,/'DIRECT'/);
 assert.match(closure,/'MAPPED'/);
 assert.match(closure,/'MIXED'/);
 assert.match(closure,/settlementIdentityStrength,/);
});

test('V175 production closure panel shows commit-bound settlement certification',()=>{
 assert.match(panel,/PRODUCTION CLOSURE/);
 assert.match(panel,/SETTLEMENT/);
 assert.match(panel,/settlementCertified/);
 assert.match(panel,/settlementMode/);
});

test('V175 production closure panel shows identity coverage and mapped reliance',()=>{
 assert.match(panel,/ID COVERAGE/);
 assert.match(panel,/settlementIdentityCoverage/);
 assert.match(panel,/MAPPED SHARE/);
 assert.match(panel,/settlementMappedIdentityShare/);
 assert.match(panel,/settlementIdentityStrength/);
 assert.match(panel,/eventProviderMapping/);
});

test('V175 production closure panel shows fallback evidence certification',()=>{
 assert.match(panel,/FALLBACK/);
 assert.match(panel,/settlementFallbackEvidenceCertified/);
 assert.match(panel,/CERTIFIED/);
 assert.match(panel,/BLOCKED/);
});

test('V175 operator note describes exact commit settlement identity requirement',()=>{
 assert.match(panel,/settlement evidence is bound to the deployed commit/);
 assert.match(panel,/every matched settlement leg is fully accounted for/);
 assert.match(panel,/Standby commit drift is expected until failover/);
});
