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
