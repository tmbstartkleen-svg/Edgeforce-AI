import fs from 'node:fs';
import path from 'node:path';

const tableNames=sql=>[...sql.matchAll(/\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?[\"\x60]?([a-z_][a-z_0-9]*)/gi)].map(m=>m[1].toLowerCase());
const pg=fs.readFileSync('db/schema.sql','utf8');
const dir='db/d1';
const d1Sql=fs.readdirSync(dir).filter(f=>f.endsWith('.sql')).sort().map(f=>fs.readFileSync(path.join(dir,f),'utf8')).join('\n');
const postgresTables=[...new Set(tableNames(pg))].sort();
const d1Tables=[...new Set(tableNames(d1Sql))].sort();
const missing=postgresTables.filter(x=>!d1Tables.includes(x));
const report={scope:'baseline PostgreSQL schema only (not every historical migration or runtime query)',postgresTables,d1Tables,missing,covered:postgresTables.length-missing.length,total:postgresTables.length,complete:missing.length===0};
console.log(JSON.stringify(report,null,2));
if(process.argv.includes('--require-parity')&&!report.complete)process.exitCode=1;
