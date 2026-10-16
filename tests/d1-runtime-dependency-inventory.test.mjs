import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
const r=spawnSync(process.execPath,['scripts/d1-runtime-dependency-inventory.mjs'],{encoding:'utf8'});
test('inventory reports production Postgres dependency without granting D1 promotion',()=>{assert.equal(r.status,0,r.stderr);const d=JSON.parse(r.stdout);assert.equal(d.d1CutoverAuthorized,false);assert.ok(d.matches>0);assert.ok(d.files.some(x=>x.file==='src/lib/db.ts'));});
test('strict full cutover gate rejects existing PostgreSQL dependency',()=>{const x=spawnSync(process.execPath,['scripts/d1-runtime-dependency-inventory.mjs','--require-zero'],{encoding:'utf8'});assert.notEqual(x.status,0);});
