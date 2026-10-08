import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';

const closure=readFileSync(new URL('../src/lib/finalProductionClosure.ts',import.meta.url),'utf8');

test('V174 settlement closure requires identity counters to reconcile exactly',()=>{
 assert.match(closure,/identityReportedTotal===settlementMatchedLegs/);
 assert.match(closure,/identitySummedTotal===settlementMatchedLegs/);
 assert.match(closure,/const identitySummedTotal=identityInternal\+identityFrozen\+identityMapped/);
 assert.match(closure,/&&settlementIdentityCertified/);
});

test('V174 zero-leg settlement receives full identity coverage only when telemetry is certified',()=>{
 assert.match(closure,/settlementMatchedLegs>0\s*\?Number\(\(identitySummedTotal\/settlementMatchedLegs\)\.toFixed\(3\)\)\s*:settlementIdentityCertified\?1:0/);
});

test('V174 closure records mapped identity reliance separately from total coverage',()=>{
 assert.match(closure,/const settlementMappedIdentityShare=settlementMatchedLegs>0/);
 assert.match(closure,/settlementIdentityCoverage,/);
 assert.match(closure,/settlementMappedIdentityShare,/);
});

test('V174 identity mismatch is an explicit production closure blocker',()=>{
 assert.match(closure,/settlement identity telemetry does not fully reconcile with matched legs for the candidate commit/);
});
