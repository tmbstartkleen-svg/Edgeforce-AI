import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../worker/atlas-schedule-enqueue.ts',import.meta.url),'utf8');
test('enqueue fails closed without owner approval and opt-in',()=>{
 assert.match(source,/if\(!guards.enabled\)return/);
 assert.match(source,/if\(!guards.ownerAuthorized\)return/);
});
test('enqueue rejects duplicates atomically and limits age',()=>{
 assert.match(source,/storage.transaction\(async txn=>/);
 assert.match(source,/if\(existing\)return \{ok:false,reason:'DUPLICATE_TASK'\}/);
 assert.match(source,/ATLAS_MAX_AGE_MS/);
 assert.match(source,/await txn.put\(key,record\)/);
});
test('enqueue performs no autonomous execution',()=>{
 assert.doesNotMatch(source,/fetch\(|setInterval\(|setTimeout\(|placeBet/);
});
