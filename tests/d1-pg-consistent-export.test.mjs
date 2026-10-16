import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {spawnSync} from 'node:child_process';
const file='scripts/d1-pg-consistent-export.mjs',src=readFileSync(file,'utf8');
test('one read-only consistent transaction covers all baseline tables',()=>{assert.match(src,/sql\.begin\('read only isolation level repeatable read'/);assert.match(src,/for\(const table of tables\)/);assert.match(src,/ROW_LIMIT_EXCEEDED_/);assert.match(src,/cutoverAuthorized:false/);});
test('no database credential means no connection attempt',()=>{const env={...process.env};delete env.EDGEFORCE_MIGRATION_SOURCE_URL;const r=spawnSync(process.execPath,[file,'/tmp'],{env,encoding:'utf8'});assert.notEqual(r.status,0);assert.match(r.stderr,/USAGE/);});
