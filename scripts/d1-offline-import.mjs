import fs from 'node:fs';
// Offline deterministic D1 SQL generator. No live connections or automatic execution.
const tables={
 teams:['id','sport','league','name','city','venue','metadata'],
 athletes:['id','sport','league','full_name','team_id','position','active','metadata','created_at','updated_at'],
 events:['id','provider_event_id','sport','league','home_team_id','away_team_id','start_time','venue','status'],
 player_game_stats:['id','athlete_id','event_id','stat_date','stats','source','imported_at'],
 weather_snapshots:['id','event_id','temp_f','wind_mph','precip_prob','humidity','roof_status','payload','pulled_at'],
};
const usage='USAGE: node scripts/d1-offline-import.mjs TABLE INPUT.jsonl OUTPUT.sql';
const fail=msg=>{console.error(msg);process.exit(1)};
const [table,input,output]=process.argv.slice(2);
if(process.argv.length!==5||!Object.hasOwn(tables,table)||!input||!output)fail(usage);
if(fs.existsSync(output))fail('OUTPUT_ALREADY_EXISTS');
const cols=tables[table];
const quote=v=>v===null?'NULL':typeof v==='number'?(Number.isFinite(v)?String(v):fail('NONFINITE_NUMBER')):typeof v==='string'?"'"+v.replaceAll("'","''")+"'":fail('INVALID_SCALAR');
const normalize=(k,v)=>{
 if(v===null)return null;
 if(['metadata','stats','payload'].includes(k)){
  if(typeof v==='string'){try{JSON.parse(v)}catch{fail('INVALID_JSON_'+k)}return v;}
  if(typeof v==='object'&&v!==null)return JSON.stringify(v);
  fail('INVALID_JSON_'+k);
 }
 if(k==='active'){if(typeof v!=='boolean'&&v!==0&&v!==1)fail('INVALID_ACTIVE');return v===true||v===1?1:0;}
 if(typeof v==='boolean')fail('UNSUPPORTED_BOOLEAN_'+k);
 if(typeof v==='number'&&!Number.isFinite(v))fail('INVALID_NUMBER_'+k);
 if(typeof v!=='string'&&typeof v!=='number')fail('INVALID_VALUE_'+k);
 return v;
};
const required={teams:['id','sport','name'],athletes:['id','sport','full_name'],events:['id','sport','start_time'],player_game_stats:['id','athlete_id','event_id','stat_date','stats'],weather_snapshots:['id','event_id']}[table];
const data=fs.readFileSync(input,'utf8');if(Buffer.byteLength(data)>10*1024*1024)fail('INPUT_EXCEEDS_10MB');
const lines=data.split(/\r?\n/).filter(s=>s.trim());if(lines.length>10000)fail('INPUT_EXCEEDS_10000_ROWS');
const statements=[];let i=0;
for(const line of lines){let row;try{row=JSON.parse(line)}catch{fail('INVALID_JSONL_ROW_'+(++i))}i++;
 if(!row||typeof row!=='object'||Array.isArray(row))fail('INVALID_ROW_'+i);
 for(const k of Object.keys(row))if(!cols.includes(k))fail('UNKNOWN_COLUMN_'+k);
 for(const k of required)if(row[k]===undefined||row[k]===null||row[k]==='')fail('MISSING_'+k+'_ROW_'+i);
 const used=cols.filter(k=>row[k]!==undefined);const values=used.map(k=>quote(normalize(k,row[k])));
 statements.push('INSERT INTO '+table+' ('+used.join(',')+') VALUES ('+values.join(',')+');');
}
if(!statements.length)fail('EMPTY_INPUT');
const sql='-- OFFLINE IMPORT: validate source and target before manual application. No automatic execution.\nBEGIN TRANSACTION;\n'+statements.join('\n')+'\nCOMMIT;\n';
fs.writeFileSync(output,sql,{flag:'wx',mode:0o600});console.log(JSON.stringify({ok:true,table,rows:statements.length,output,executed:false}));
