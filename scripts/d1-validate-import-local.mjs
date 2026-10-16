import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
// Execute reviewed offline imports only against a disposable in-memory SQLite database.
// No Cloudflare API, Wrangler CLI, D1 binding, secrets, or persistent production target.
const base=process.argv[2];
const tables=['teams','athletes','events','market_snapshots','player_game_stats','injury_snapshots','weather_snapshots','model_runs','bet_results','calibration_metrics'];
const fail=message=>{console.error(JSON.stringify({ok:false,error:message,productionTouched:false}));process.exit(1)};
if(process.argv.length!==3||!base)fail('USAGE: node scripts/d1-validate-import-local.mjs OFFLINE_PLAN_DIR');
const planPath=path.join(base,'plan.json');
let plan;try{plan=JSON.parse(fs.readFileSync(planPath,'utf8'))}catch{fail('PLAN_NOT_FOUND_OR_INVALID')}
if(plan?.status!=='OFFLINE_REVIEW_ONLY'||plan?.databaseWritesExecuted!==false||plan?.cutoverAuthorized!==false||!Array.isArray(plan.files)||plan.files.length!==tables.length)fail('INVALID_PLAN');
const listed=plan.files.map(f=>f.table);
if(listed.some((x,i)=>x!==tables[i]))fail('UNEXPECTED_TABLE_SEQUENCE');
const db=new DatabaseSync(':memory:');
try{
 db.exec('PRAGMA foreign_keys = ON');
 for(const schema of ['0001_intelligence_pilot.sql','0002_reference_entities.sql','0003_baseline_sports.sql'])db.exec(fs.readFileSync(path.join('db/d1',schema),'utf8'));
 const counts={};
 for(const spec of plan.files){
  if(!Number.isSafeInteger(spec.rows)||spec.rows<1||spec.rows>10000)fail('INVALID_PLANNED_ROW_COUNT');
  const expected=path.resolve(base,spec.table+'.sql');
  if(typeof spec.file!=='string'||path.resolve(spec.file)!==expected)fail('IMPORT_FILE_OUTSIDE_PLAN');
  const sql=fs.readFileSync(expected,'utf8');
  if(!/^-- OFFLINE IMPORT:/.test(sql)||!sql.includes('BEGIN TRANSACTION;')||!sql.trimEnd().endsWith('COMMIT;'))fail('INVALID_SQL_BATCH');
  db.exec(sql);
  const count=Number(db.prepare('SELECT count(*) AS n FROM "'+spec.table+'"').get().n);
  if(count!==spec.rows)fail('IMPORTED_ROW_COUNT_MISMATCH_'+spec.table);
  counts[spec.table]=count;
 }
 const violations=db.prepare('PRAGMA foreign_key_check').all();
 if(violations.length)fail('FOREIGN_KEY_VIOLATIONS');
 console.log(JSON.stringify({ok:true,kind:'IN_MEMORY_SQLITE_IMPORT_VALIDATION',counts,productionTouched:false,cloudflareTouched:false,cutoverAuthorized:false}));
}catch(error){fail('LOCAL_IMPORT_VALIDATION_FAILED_'+String(error?.message||error).slice(0,180))}finally{db.close()}
