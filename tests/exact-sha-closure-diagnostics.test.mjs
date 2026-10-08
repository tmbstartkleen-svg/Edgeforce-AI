import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';

const closure=readFileSync(new URL('../src/lib/finalProductionClosure.ts',import.meta.url),'utf8');
const diagnostics=readFileSync(new URL('../src/lib/finalClosureDiagnostics.ts',import.meta.url),'utf8');
const panel=readFileSync(new URL('../src/components/FinalProductionClosurePanel.tsx',import.meta.url),'utf8');

test('V178 closure evidence exposes observed settlement deployment SHA',()=>{
 assert.match(closure,/settlementCommitSha:settlementMetadata\?\.deploymentCommit\|\|null/);
});

test('V178 diagnostics independently certifies settlement SHA binding',()=>{
 assert.match(diagnostics,/const expectedCommit=String\(input\.commitSha\|\|''\)\|\|null/);
 assert.match(diagnostics,/const observedCommit=String\(evidence\.settlementCommitSha\|\|''\)\|\|null/);
 assert.match(diagnostics,/const commitBound=Boolean\(expectedCommit&&observedCommit&&expectedCommit===observedCommit\)/);
 assert.match(diagnostics,/SETTLEMENT_COMMIT_NOT_BOUND/);
 assert.match(diagnostics,/&&commitBound/);
});

test('V178 operator panel exposes settlement SHA certificate',()=>{
 assert.match(panel,/SHA BOUND/);
 assert.match(panel,/settlementCommitSha/);
 assert.match(panel,/commitBinding/);
});
