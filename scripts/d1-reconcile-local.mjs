import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
// Offline source-vs-imported-content checks against disposable SQLite.
// Never opens or changes a Cloudflare, Neon or production database.
const tables=['teams','athletes','events','market_snapshots','player_game_stats','injury_snapshots','weather_snapshots','model_runs','bet_results','calibration_metrics'];
const [sourceDir,planDir]=process.argv.slice(2);
const fail=s=>{console.error(JSON.stringify({ok:false,reason:s,productionTouched:false}));process.exit(1)};
if(process.argv.length!==4)fail('USAGE: node scripts/d1-reconcile-local.mjs SOURCE_JSONL_DIR OFFLINE_PLAN_DIR');
let plan;try{plan=JSON.parse(fs.readFileSync(path.join(planDir,'plan.json'),'utf8'))}catch{fail('INVALID_PLAN')}
if(plan.status!=='OFFLINE_REVIEW_ONLY'||plan.cutoverAuthorized!==false||plan.databaseWritesExecuted!==false||!Array.isArray(plan.files)||plan.files.length!==10)fail('UNSAFE_PLAN');
const canonical=x=>{if(x===null||typeof x!=='object')return JSON.stringify(x);if(Array.isArray(x))return '['+x.map(canonical).join(',')+']';return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}'};
const digest=rows=>createHash('sha256').update(rows.map(canonical).sort().join('\n')+'\n').digest('hex');
const db=new DatabaseSync(':memory:');
try{
 db.exec('PRAGMA foreign_keys = ON');
 for(const name of ['0001_intelligence_pilot.sql','0002_reference_entities.sql','0003_baseline_sports.sql'])db.exec(fs.readFileSync(path.join('db/d1',name),'utf8'));
 const evidence={};
 for(let i=0;i<tables.length;i++){
  const table=tables[i],spec=plan.files[i];if(spec?.table!==table)fail('TABLE_SEQUENCE_MISMATCH');
  const sqlFile=path.resolve(planDir,table+'.sql');
  if(typeof spec.file!=='string'||path.resolve(spec.file)!==sqlFile)fail('UNTRUSTED_SQL_PATH');
  const sql=fs.readFileSync(sqlFile,'utf8');if(!sql.startsWith('-- OFFLINE IMPORT:')||!sql.trim().endsWith('COMMIT;'))fail('UNTRUSTED_SQL_FORMAT');
  const input=fs.readFileSync(path.join(sourceDir,table+'.jsonl'),'utf8').trim().split(/\r?\n/).filter(Boolean).map(x=>JSON.parse(x));
  if(input.length!==spec.rows||input.length>10000)fail('SOURCE_ROWS_MISMATCH');
  db.exec(sql);
  const rows=db.prepare('SELECT * FROM "'+table+'" ORDER BY id').all();
  if(rows.length!==input.length)fail('IMPORT_ROWS_MISMATCH_'+table);
  // Compare only explicitly exported columns: D1 can add timestamp defaults.
  const normalized=rows.map(row=>Object.fromEntries(Object.entries(row).filter(([key])=>input[0]&&Object.hasOwn(input[0],key)).map(([key,value])=>[key,['metadata','stats','payload','raw','feature_snapshot'].includes(key)&&typeof value==='string'?JSON.parse(value):key==='active'&&typeof value==='number'?Boolean(value):value])));
  // Do not certify numeric precision differences or date serialization as equal.
  if(digest(input)!==digest(normalized))fail('CONTENT_MISMATCH_'+table);
  evidence[table]={rows:rows.length,digest:digest(normalized)};
 }
 if(db.prepare('PRAGMA foreign_key_check').all().length)fail('FOREIGN_KEY_VIOLATIONS');
 console.log(JSON.stringify({ok:true,scope:'OFFLINE_SQLITE_CONTENT_RECONCILIATION_ONLY',tables:evidence,productionTouched:false,cutoverAuthorized:false}));
}catch(e){fail(String(e?.message||e).slice(0,200))}finally{db.close()}
