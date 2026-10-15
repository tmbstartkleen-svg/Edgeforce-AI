import fs from 'node:fs';
import {createHash} from 'node:crypto';
// Offline evidence only. No database credentials, connections, writes or cutover.
const tables=['teams','athletes','events','market_snapshots','player_game_stats','injury_snapshots','weather_snapshots','model_runs','bet_results','calibration_metrics'];
const fail=(message)=>{console.error(JSON.stringify({ok:false,error:message}));process.exit(1)};
const [source,target]=process.argv.slice(2);
if(!source||!target||process.argv.length!==4)fail('USAGE: node scripts/d1-migration-preflight.mjs source.json target.json');
const load=file=>{let data;try{data=JSON.parse(fs.readFileSync(file,'utf8'))}catch{fail('INVALID_OR_UNREADABLE_MANIFEST')};if(!data||Array.isArray(data)||typeof data!=='object'||data.schemaVersion!==1||!data.tables||typeof data.tables!=='object'||Array.isArray(data.tables))fail('INVALID_MANIFEST_SCHEMA');return data;};
const a=load(source),b=load(target);
const nonnegative=n=>Number.isSafeInteger(n)&&n>=0;
const sha=s=>typeof s==='string'&&/^[a-f0-9]{64}$/i.test(s);
const failures=[];
for(const table of tables){const s=a.tables[table],t=b.tables[table];if(!s||!t){failures.push({table,error:'MISSING_TABLE_EVIDENCE'});continue;}
 if(!nonnegative(s.count)||!nonnegative(t.count)||!sha(s.digest)||!sha(t.digest)){failures.push({table,error:'INVALID_EVIDENCE'});continue;}
 if(s.count!==t.count)failures.push({table,error:'ROW_COUNT_MISMATCH',source:s.count,target:t.count});
 if(s.digest.toLowerCase()!==t.digest.toLowerCase())failures.push({table,error:'CONTENT_DIGEST_MISMATCH'});
}
for(const side of [a,b])for(const key of Object.keys(side.tables))if(!tables.includes(key))failures.push({table:key,error:'UNEXPECTED_TABLE_EVIDENCE'});
const report={ok:failures.length===0,kind:'OFFLINE_MANIFEST_COMPARISON_ONLY',tablesChecked:tables.length,failures,cutoverAuthorized:false,neonSecondaryCertified:false,reportDigest:createHash('sha256').update(JSON.stringify({tables,failures})).digest('hex')};
console.log(JSON.stringify(report,null,2));
if(!report.ok)process.exitCode=1;
