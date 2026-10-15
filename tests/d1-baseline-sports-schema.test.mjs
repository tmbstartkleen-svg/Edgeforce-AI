import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const sql=readFileSync('db/d1/0003_baseline_sports.sql','utf8');
test('baseline sports domain schema includes seven tables and settlement relationship',()=>{
 for(const name of ['market_snapshots','player_game_stats','injury_snapshots','weather_snapshots','model_runs','bet_results','calibration_metrics'])assert.match(sql,new RegExp('CREATE TABLE IF NOT EXISTS '+name+'\\s*\\(','i'));
 assert.match(sql,/model_run_id INTEGER REFERENCES model_runs\(id\)/);
 assert.match(sql,/UNIQUE\(athlete_id,event_id\)/);
 assert.match(sql,/CHECK\(json_valid\(stats\)\)/);
 assert.doesNotMatch(sql,/DROP TABLE|TRUNCATE|DELETE FROM/i);
});
test('baseline table inventory is now covered, but runtime cutover gate remains closed',()=>{
 const r=spawnSync(process.execPath,['scripts/d1-schema-coverage.mjs'],{encoding:'utf8'});
 assert.equal(r.status,0,r.stderr);const report=JSON.parse(r.stdout);
 assert.equal(report.missing.length,0);
 assert.equal(report.complete,true);
 const cut=spawnSync(process.execPath,['scripts/storage-topology-gate.mjs'],{encoding:'utf8',env:{...process.env,EDGEFORCE_PRIMARY_STORAGE:'d1'}});
 assert.notEqual(cut.status,0);
 assert.match(cut.stderr,/d1FullApplicationReady/);
});
