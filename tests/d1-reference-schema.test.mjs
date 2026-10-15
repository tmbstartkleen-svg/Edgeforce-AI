import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const schema=fs.readFileSync('db/d1/0002_reference_entities.sql','utf8');
test('D1 reference schema preserves stable ids and JSON validation',()=>{
 for(const name of ['teams','athletes','events'])assert.match(schema,new RegExp('CREATE TABLE IF NOT EXISTS '+name+'\\s*\\(','i'));
 assert.match(schema,/provider_event_id TEXT UNIQUE/);
 assert.match(schema,/CHECK\(json_valid\(metadata\)\)/);
 assert.match(schema,/CHECK\(active IN \(0,1\)\)/);
 assert.match(schema,/events_time_idx/);
});
test('D1 reference tables extend the inventory but cannot claim full production parity',()=>{
 const run=spawnSync(process.execPath,['scripts/d1-schema-coverage.mjs'],{encoding:'utf8'});
 assert.equal(run.status,0,run.stderr);
 const report=JSON.parse(run.stdout);
 for(const table of ['teams','athletes','events'])assert.ok(report.d1Tables.includes(table));
 for(const table of ['model_runs','bet_results'])assert.ok(report.d1Tables.includes(table));
 assert.equal(report.complete,true);
 const cut=spawnSync(process.execPath,['scripts/storage-topology-gate.mjs'],{encoding:'utf8',env:{...process.env,EDGEFORCE_PRIMARY_STORAGE:'d1'}});
 assert.notEqual(cut.status,0);
});
