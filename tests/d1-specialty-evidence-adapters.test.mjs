import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const source=fs.readFileSync(new URL('../worker/d1-specialty-evidence-adapters.ts',import.meta.url),'utf8');
test('specialty input requires source provenance and distinct field sets',()=>{for(const k of ['player-stat','injury','weather','MISSING_PROVENANCE_OR_PAYLOAD','MISSING_REQUIRED_FIELDS'])assert.ok(source.includes(k));assert.match(source,/assessIngestEvidence\(/);});
test('specialty adapters do not assert independent validation or place bets',()=>{assert.match(source,/independentlyVerified:false/);assert.match(source,/approvedForBetting:false/);assert.doesNotMatch(source,/\b(?:INSERT|UPDATE|DELETE|DROP|fetch)\s*\(/i);});
