import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';
const script=new URL('../scripts/d1-restore-evidence-gate.mjs',import.meta.url).pathname;
const names=['teams','athletes','events','market_snapshots','player_game_stats','injury_snapshots','weather_snapshots','model_runs','bet_results','calibration_metrics'];
const tables=()=>names.map(table=>({table,count:1,sha256:'a'.repeat(64)}));
function run(a,b){const dir=mkdtempSync(path.join(os.tmpdir(),'d1-restore-'));try{const f=path.join(dir,'source.json'),g=path.join(dir,'restored.json');writeFileSync(f,JSON.stringify(a));writeFileSync(g,JSON.stringify(b));return spawnSync(process.execPath,[script,f,g],{encoding:'utf8'});}finally{rmSync(dir,{recursive:true,force:true});}}
const original=()=>({snapshotId:'source-12345678',tables:tables()});
const restored=()=>({snapshotId:'restore-12345678',sourceSnapshotId:'source-12345678',restoreTestPassed:true,restoreTestEnvironment:'ISOLATED',readVerificationPassed:true,tables:tables()});
test('identical evidence is not independently authenticated or approved for cutover',()=>{const x=run(original(),restored());assert.equal(x.status,0,x.stderr);const output=JSON.parse(x.stdout);assert.equal(output.complete,true);assert.equal(output.productionCutoverAuthorized,false);assert.equal(output.independentlyAuthenticated,false);});
test('missing restore test or copy-pasted identity is rejected',()=>{const b=restored();b.readVerificationPassed=false;assert.notEqual(run(original(),b).status,0);const c=restored();c.snapshotId=c.sourceSnapshotId;assert.notEqual(run(original(),c).status,0);});
test('changed or missing table rejects restore',()=>{const b=restored();b.tables[0].sha256='b'.repeat(64);assert.notEqual(run(original(),b).status,0);const c=restored();c.tables.pop();assert.notEqual(run(original(),c).status,0);});
