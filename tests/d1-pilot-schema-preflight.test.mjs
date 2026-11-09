import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
test('shared Cloudflare D1 database must block any pilot schema writes',()=>{
 const run=spawnSync(process.execPath,['scripts/d1-pilot-schema-preflight.mjs'],{encoding:'utf8'});
 const state=JSON.parse(run.stdout);assert.equal(state.productionCutoverAuthorized,false);
 if(state.pilotDatabaseConfigured&&state.productionDatabaseConfigured&&!state.isolated){assert.notEqual(run.status,0);assert.match(run.stderr,/D1_PILOT_DATABASE_SHARED_OR_UNCONFIGURED/);}
 else assert.equal(run.status,0,run.stderr);
});
