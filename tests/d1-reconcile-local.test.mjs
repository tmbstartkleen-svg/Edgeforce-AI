import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {spawnSync} from 'node:child_process';
const src=fs.readFileSync('scripts/d1-reconcile-local.mjs','utf8');
test('comparison uses disposable SQLite and never a live binding',()=>{assert.match(src,/new DatabaseSync\(':memory:'\)/);assert.match(src,/CONTENT_MISMATCH_/);assert.match(src,/PRAGMA foreign_key_check/);assert.doesNotMatch(src,/wrangler|fetch\(|postgres\(/i);});
test('invalid arguments fail closed before opening any database',()=>{const x=spawnSync(process.execPath,['scripts/d1-reconcile-local.mjs'],{encoding:'utf8'});assert.notEqual(x.status,0);assert.match(x.stderr,/USAGE/);});
