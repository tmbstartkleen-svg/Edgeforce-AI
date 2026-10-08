import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';

const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const provider=read('src/lib/resultProvider.ts');
const ledger=read('src/lib/ledger.ts');

test('V172 fallback evidence certification fails closed on every blocked final category',()=>{
 assert.match(provider,/fallback\.evidence\.blockedFinalGames===0/);
 assert.match(provider,/fallback\.evidence\.blockedConflict===0/);
 assert.match(provider,/fallback\.evidence\.blockedLowConfidence===0/);
 assert.match(provider,/fallback\.evidence\.blockedSingleSource===0/);
});

test('V172 automatic settlement exposes identity-path match telemetry',()=>{
 assert.match(provider,/settlementIdentityMatches:\{/);
 assert.match(provider,/internalEventId:reconciliation\.internalIdentityMatches/);
 assert.match(provider,/frozenSourceEventId:reconciliation\.frozenSourceIdentityMatches/);
 assert.match(provider,/eventProviderMapping:reconciliation\.mappedSourceIdentityMatches/);
 assert.match(provider,/total:reconciliation\.matchedLegs/);
});

test('V172 durable settlement evidence summarizes identity match coverage',()=>{
 assert.match(ledger,/const identityMatches:Record<string,number>=\{\}/);
 assert.match(ledger,/const identity=String\(row\.payload\?\.identityMatch\|\|''\)\.trim\(\)/);
 assert.match(ledger,/identityMatches\[identity\]=\(identityMatches\[identity\]\|\|0\)\+1/);
 assert.match(ledger,/identityCoverage:normalized\.length\?Number\(\(identityTagged\/normalized\.length\)\.toFixed\(3\)\):1/);
});

test('V172 dry-run evidence shape includes identity telemetry',()=>{
 assert.match(ledger,/identityMatches:\{\},identityCoverage:1/);
});
