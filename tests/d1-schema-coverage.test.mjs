import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const run=extra=>spawnSync(process.execPath,['scripts/d1-schema-coverage.mjs',...extra],{encoding:'utf8'});
test('D1 coverage reports baseline PostgreSQL tables and missing migrations',()=>{
 const x=run([]);assert.equal(x.status,0,x.stderr);
 const d=JSON.parse(x.stdout);assert.ok(d.total>=10);
 assert.equal(d.total,d.covered+d.missing.length);
 assert.ok(d.postgresTables.includes('model_runs'));
 assert.ok(d.postgresTables.includes('bet_results'));
 assert.ok(d.d1Tables.includes('intelligence_observations'));
});
test('strict D1 parity cannot be certified while baseline tables are missing',()=>{
 const x=run(['--require-parity']);assert.notEqual(x.status,0);
 const d=JSON.parse(x.stdout);assert.equal(d.complete,false);
 assert.ok(d.missing.includes('model_runs'));
});
