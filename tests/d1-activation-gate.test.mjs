import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
const run=env=>spawnSync(process.execPath,['scripts/d1-activation-gate.mjs'],{encoding:'utf8',env:{...process.env,...env}});
test('disabled D1 collector passes without permanent secrets',()=>{const x=run({D1_PILOT_CRON_SECRET:'',D1_PILOT_INGEST_SECRET:''});assert.equal(x.status,0);assert.match(x.stdout,/disabled/)});
