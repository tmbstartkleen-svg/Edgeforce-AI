import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const code=readFileSync('scripts/d1-pg-source-schema-preflight.mjs','utf8');
test('schema preflight is read only and covers all baseline tables',()=>{
 assert.match(code,/read only isolation level repeatable read/);
 assert.match(code,/information_schema.columns/);
 assert.match(code,/unmappedColumns/);
 assert.match(code,/cutoverAuthorized:false/);
});
test('missing migration credential fails without making a connection',()=>{
 const env={...process.env};delete env.EDGEFORCE_MIGRATION_SOURCE_URL;
 const result=spawnSync(process.execPath,['scripts/d1-pg-source-schema-preflight.mjs'],{env,encoding:'utf8'});
 assert.notEqual(result.status,0);
 assert.match(result.stderr,/EDGEFORCE_MIGRATION_SOURCE_URL_REQUIRED/);
});
