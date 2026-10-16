import postgres from 'postgres';
import fs from 'node:fs';
import path from 'node:path';

// Deliberately read-only, bounded snapshot exporter. Never writes to any database.
const tables=['teams','athletes','events','market_snapshots','player_game_stats','injury_snapshots','weather_snapshots','model_runs','bet_results','calibration_metrics'];
const table=process.argv[2],output=process.argv[3];
const fail=(reason)=>{console.error(reason);process.exit(1)};
if(process.argv.length!==4||!tables.includes(table)||!output)fail('USAGE: node scripts/d1-pg-readonly-export.mjs TABLE OUTPUT.jsonl');
const maxRows=10000;
const url=process.env.EDGEFORCE_MIGRATION_SOURCE_URL;
if(!url)fail('EDGEFORCE_MIGRATION_SOURCE_URL_REQUIRED');
if(fs.existsSync(output))fail('OUTPUT_ALREADY_EXISTS');
const sql=postgres(url,{max:1,prepare:false,connect_timeout:8,idle_timeout:5});
let out;
try{
 // The table allowlist prevents dynamic identifier injection. Transaction snapshot is consistent within one table.
 const rows=await sql.begin('read only isolation level repeatable read',async tx=>{
   const countResult=await tx.unsafe('SELECT count(*)::text AS n FROM "'+table+'"');
   const count=Number(countResult[0]?.n);
   if(!Number.isSafeInteger(count)||count>maxRows)throw new Error('ROW_LIMIT_EXCEEDED_USE_SNAPSHOT_PAGINATION');
   const result=await tx.unsafe('SELECT * FROM "'+table+'" ORDER BY id LIMIT '+(maxRows+1));
   if(result.length!==count)throw new Error('SNAPSHOT_ROW_COUNT_MISMATCH');
   return result;
 });
 const dir=path.dirname(path.resolve(output));
 if(!fs.existsSync(dir))fail('OUTPUT_PARENT_MISSING');
 out=fs.openSync(output,'wx',0o600);
 for(const row of rows)fs.writeSync(out,JSON.stringify(row,(_,v)=>typeof v==='bigint'?v.toString():v)+'\n');
 fs.closeSync(out);out=undefined;
 console.log(JSON.stringify({ok:true,table,rows:rows.length,output,mode:'READ_ONLY_SINGLE_TABLE_SNAPSHOT',completeDatabaseSnapshot:false}));
}catch(error){
 if(out!==undefined){fs.closeSync(out);try{fs.unlinkSync(output)}catch{}}
 fail('EXPORT_FAILED: '+String(error?.message||error).replace(url,'[REDACTED]'));
}finally{await sql.end({timeout:2})}
