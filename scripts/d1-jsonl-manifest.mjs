import fs from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
// Offline evidence generation from ten JSONL exports. Does not query or mutate databases.
const tables=['teams','athletes','events','market_snapshots','player_game_stats','injury_snapshots','weather_snapshots','model_runs','bet_results','calibration_metrics'];
const [directory,output]=process.argv.slice(2);
const fail=s=>{console.error(s);process.exit(1)};
if(process.argv.length!==4||!directory||!output)fail('USAGE: node scripts/d1-jsonl-manifest.mjs INPUT_DIR OUTPUT.json');
if(fs.existsSync(output))fail('OUTPUT_ALREADY_EXISTS');
const canonical=v=>{if(v===null||typeof v!=='object')return JSON.stringify(v);if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}'};
const result={schemaVersion:1,tables:{}};
for(const table of tables){const file=path.join(directory,table+'.jsonl');let raw;try{raw=fs.readFileSync(file,'utf8')}catch{fail('MISSING_TABLE_FILE_'+table)}
 if(Buffer.byteLength(raw)>32*1024*1024)fail('FILE_TOO_LARGE_'+table);
 const lines=raw.split(/\r?\n/).filter(x=>x.trim());if(lines.length>10000)fail('ROW_LIMIT_'+table);
 const rows=[];const ids=new Set();
 for(const line of lines){let row;try{row=JSON.parse(line)}catch{fail('INVALID_ROW_'+table)}if(!row||Array.isArray(row)||typeof row!=='object'||!Object.hasOwn(row,'id')||row.id===null)fail('MISSING_ROW_ID_'+table);
 const id=String(row.id);if(ids.has(id))fail('DUPLICATE_ROW_ID_'+table);ids.add(id);rows.push([id,canonical(row)]);}
 rows.sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0);
 const digest=createHash('sha256').update(rows.map(x=>x[1]).join('\n')+(rows.length?'\n':'')).digest('hex');result.tables[table]={count:rows.length,digest};
}
fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n',{flag:'wx',mode:0o600});console.log(JSON.stringify({ok:true,output,tableCount:tables.length,comparisonOnly:true,cutoverAuthorized:false}));
