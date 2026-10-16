import postgres from 'postgres';
import {readFileSync} from 'node:fs';
const source=process.env.EDGEFORCE_MIGRATION_SOURCE_URL;
if(!source){console.error('EDGEFORCE_MIGRATION_SOURCE_URL_REQUIRED');process.exit(1)}
const contract=readFileSync('scripts/d1-pg-consistent-export.mjs','utf8');
const names=['teams','athletes','events','market_snapshots','player_game_stats','injury_snapshots','weather_snapshots','model_runs','bet_results','calibration_metrics'];
const allowed=Object.fromEntries([...contract.matchAll(/^([a-z_]+):\[([^\]]+)\]/gm)].filter(x=>names.includes(x[1])).map(x=>[x[1],x[2].split(',').map(s=>s.trim().replaceAll("'",""))]));
const sql=postgres(source,{max:1,prepare:false,connect_timeout:8});
try{
 const report=await sql.begin('read only isolation level repeatable read',async tx=>{
  const tables=[];
  for(const name of names){
   const cols=await tx.unsafe("SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name=$1 ORDER BY ordinal_position",[name]);
   const actual=cols.map(x=>x.column_name);
   const unknown=actual.filter(x=>!allowed[name]?.includes(x));
   const missing=actual.length===0;
   tables.push({table:name,exists:!missing,columns:actual.length,unmappedColumns:unknown,compatible:!missing&&unknown.length===0});
  }
  return tables;
 });
 const ok=report.every(x=>x.compatible);
 console.log(JSON.stringify({ok,kind:'READ_ONLY_SOURCE_SCHEMA_PREFLIGHT',tables:report,productionWrites:false,d1Writes:false,cutoverAuthorized:false},null,2));
 if(!ok)process.exitCode=1;
}catch(error){console.error('SOURCE_SCHEMA_PREFLIGHT_FAILED:'+String(error?.code??error?.name??'UNKNOWN'));process.exitCode=1}
finally{await sql.end({timeout:2})}
