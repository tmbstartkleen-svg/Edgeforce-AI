const allowedColumns={
teams:['id','sport','league','name','city','venue','metadata'],
athletes:['id','sport','league','full_name','team_id','position','active','metadata','created_at','updated_at'],
events:['id','provider_event_id','sport','league','home_team_id','away_team_id','start_time','venue','status'],
market_snapshots:['id','event_id','provider','bookmaker','market_key','selection_key','american_odds','point','pulled_at','raw'],
player_game_stats:['id','athlete_id','event_id','stat_date','stats','source','imported_at'],
injury_snapshots:['id','athlete_id','team_id','status','detail','source','reported_at','pulled_at'],
weather_snapshots:['id','event_id','temp_f','wind_mph','precip_prob','humidity','roof_status','payload','pulled_at'],
model_runs:['id','event_id','market_key','selection_key','model_version','run_count','market_probability','model_probability','fair_american_odds','expected_value','full_kelly','fractional_kelly','agreement','confidence','grade','feature_snapshot','created_at'],
bet_results:['id','model_run_id','event_id','market_key','selection_key','offered_odds','closing_odds','result','clv','pnl','settled_at'],
calibration_metrics:['id','model_version','sport','market_key','sample_size','brier_score','log_loss','calibration_error','period_start','period_end','created_at']
};
import postgres from 'postgres';
import fs from 'node:fs';
import path from 'node:path';
// Single repeatable-read PostgreSQL transaction for all ten baseline tables.
// Files are staged locally, never imported or deployed by this script.
const tables=['teams','athletes','events','market_snapshots','player_game_stats','injury_snapshots','weather_snapshots','model_runs','bet_results','calibration_metrics'];
const dir=process.argv[2],url=process.env.EDGEFORCE_MIGRATION_SOURCE_URL;
const fail=message=>{console.error(message);process.exitCode=1};
if(process.argv.length!==3||!dir||!url){fail('USAGE: EDGEFORCE_MIGRATION_SOURCE_URL=... node scripts/d1-pg-consistent-export.mjs EMPTY_OUTPUT_DIR');}
else if(!fs.existsSync(dir)||!fs.statSync(dir).isDirectory()||fs.readdirSync(dir).length){fail('OUTPUT_DIRECTORY_MUST_BE_EMPTY');}
else{
 const sql=postgres(url,{max:1,prepare:false,connect_timeout:8,idle_timeout:5});
 const staged=[];
 try{
   const counts=await sql.begin('read only isolation level repeatable read',async tx=>{
     const info={};
     for(const table of tables){
       const total=await tx.unsafe('SELECT count(*)::text AS n FROM "'+table+'"');
       const count=Number(total[0]?.n);
       if(!Number.isSafeInteger(count)||count>10000)throw new Error('ROW_LIMIT_EXCEEDED_'+table);
       // Stable whole-row JSON ordering avoids assuming every legacy table has an id column.
       // At most 10,000 source rows can pass the count gate above.
       const sourceColumns=await tx.unsafe("SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name=$1",[table]);
       const sourceNames=sourceColumns.map(x=>x.column_name);
       const accepted=allowedColumns[table];
       if(!sourceNames.length||sourceNames.some(name=>!accepted.includes(name)))throw new Error('UNMAPPED_SOURCE_COLUMNS_'+table);
       const rows=await tx.unsafe('SELECT * FROM "'+table+'" AS t ORDER BY to_jsonb(t)::text LIMIT 10001');
       if(rows.length!==count)throw new Error('ROW_COUNT_MISMATCH_'+table);
       const file=path.join(dir,table+'.jsonl');
       const fd=fs.openSync(file,'wx',0o600);staged.push(file);
       try{for(const row of rows)fs.writeSync(fd,JSON.stringify(row,(_,v)=>typeof v==='bigint'?v.toString():v)+'\n');}finally{fs.closeSync(fd)}
       info[table]=count;
     }
     return info;
   });
   const file=path.join(dir,'snapshot-status.json');
   fs.writeFileSync(file,JSON.stringify({kind:'SINGLE_READ_ONLY_REPEATABLE_READ_TRANSACTION',tables:counts,databaseWrites:false,cutoverAuthorized:false},null,2)+'\n',{flag:'wx',mode:0o600});
   console.log(JSON.stringify({ok:true,tables:tables.length,counts,consistentAcrossTables:true,cutoverAuthorized:false}));
 }catch(e){for(const file of staged)try{fs.unlinkSync(file)}catch{};fail('SNAPSHOT_FAILED_'+String(e?.message||e).replaceAll(url,'[REDACTED]'))}
 finally{await sql.end({timeout:2})}
}
