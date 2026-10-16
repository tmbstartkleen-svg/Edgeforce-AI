import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
// Offline planning only: validates ten source files and generates SQL without applying it.
const tables=['teams','athletes','events','market_snapshots','player_game_stats','injury_snapshots','weather_snapshots','model_runs','bet_results','calibration_metrics'];
const [input,output]=process.argv.slice(2);
const fail=x=>{console.error(x);process.exit(1)};
if(process.argv.length!==4||!input||!output)fail('USAGE: node scripts/d1-plan-offline-import.mjs INPUT_DIR EMPTY_OUTPUT_DIR');
if(!fs.existsSync(input)||!fs.statSync(input).isDirectory())fail('INPUT_DIRECTORY_REQUIRED');
if(!fs.existsSync(output)||!fs.statSync(output).isDirectory()||fs.readdirSync(output).length)fail('OUTPUT_DIRECTORY_MUST_BE_EMPTY');
const run=(script,args)=>{const r=spawnSync(process.execPath,[script,...args],{encoding:'utf8',maxBuffer:1024*1024});if(r.status!==0)fail('SUBSTEP_FAILED '+path.basename(script)+' '+(r.stderr||r.stdout).slice(0,300));return JSON.parse(r.stdout)};
const manifest=run('scripts/d1-jsonl-manifest.mjs',[input,path.join(output,'source-manifest.json')]);
const counts=JSON.parse(fs.readFileSync(path.join(output,'source-manifest.json'),'utf8')).tables;
if(tables.some(t=>counts[t].count===0))fail('EMPTY_TABLE_REQUIRES_OPERATOR_REVIEW');
const sql=[];
for(const table of tables){const target=path.join(output,table+'.sql');run('scripts/d1-offline-import.mjs',[table,path.join(input,table+'.jsonl'),target]);sql.push({table,rows:counts[table].count,file:target});}
fs.writeFileSync(path.join(output,'plan.json'),JSON.stringify({schemaVersion:1,status:'OFFLINE_REVIEW_ONLY',databaseWritesExecuted:false,cutoverAuthorized:false,wholeDatabaseSnapshotCertified:false,files:sql},null,2)+'\n',{flag:'wx',mode:0o600});
console.log(JSON.stringify({ok:true,kind:'OFFLINE_IMPORT_PLAN',tableCount:sql.length,rows:sql.reduce((n,x)=>n+x.rows,0),databaseWritesExecuted:false,cutoverAuthorized:false}));
