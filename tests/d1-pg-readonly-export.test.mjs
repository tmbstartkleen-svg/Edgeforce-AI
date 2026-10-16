import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import {readFileSync} from 'node:fs';
const path='scripts/d1-pg-readonly-export.mjs';const src=readFileSync(path,'utf8');
test('export requires explicitly supplied source URL and allowlisted table',()=>{
 const env={...process.env};delete env.EDGEFORCE_MIGRATION_SOURCE_URL;
 const missing=spawnSync(process.execPath,[path,'teams','/tmp/unused.jsonl'],{encoding:'utf8',env});assert.notEqual(missing.status,0);assert.match(missing.stderr,/EDGEFORCE_MIGRATION_SOURCE_URL_REQUIRED/);
 const bad=spawnSync(process.execPath,[path,'teams;DROP TABLE teams','/tmp/unused.jsonl'],{encoding:'utf8',env});assert.notEqual(bad.status,0);assert.match(bad.stderr,/USAGE/);
});
test('read-only repeatable-read scoped export remains intentionally bounded',()=>{
 assert.match(src,/read only isolation level repeatable read/);
 assert.match(src,/ROW_LIMIT_EXCEEDED_USE_SNAPSHOT_PAGINATION/);
 assert.match(src,/ORDER BY id LIMIT/);
 assert.doesNotMatch(src,/\b(?:INSERT|UPDATE|DELETE|DROP|TRUNCATE)\s+(?:INTO|FROM|TABLE)/i);
});
