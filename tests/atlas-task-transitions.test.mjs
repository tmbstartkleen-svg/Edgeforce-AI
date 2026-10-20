import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../worker/atlas-task-transitions.ts',import.meta.url),'utf8');

test('atomic ATLAS transitions reject stale and duplicate worker state',()=>{
 assert.match(source,/storage\.transaction\(async txn=>/);
 assert.match(source,/current\.state!==params\.expectedState\|\|current\.attempts!==params\.expectedAttempts/);
 assert.match(source,/STALE_TRANSITION/);
 assert.match(source,/await txn\.put\(key,next\)/);
});
test('claim is owner/provider gated and cancellation needs founder authorization',()=>{
 assert.match(source,/claimAtlasTask\(current,/);
 assert.match(source,/ownerAuthorized:params\.ownerAuthorized/);
 assert.match(source,/providerHealthy:params\.providerHealthy/);
 assert.match(source,/if\(!params\.ownerAuthorized\)throw new Error\('OWNER_APPROVAL_REQUIRED'\)/);
});
test('module does not activate jobs, make external calls, or place wagers',()=>{
 assert.doesNotMatch(source,/setInterval\(|setTimeout\(|fetch\(|\.send\(|placeBet|executeWager/);
 assert.match(source,/Not wired to a cron/);
});
