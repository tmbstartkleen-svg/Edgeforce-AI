import fs from 'node:fs';
import path from 'node:path';
// Inventory production database dependencies before any D1 primary promotion.
// Read-only static scan; intentionally conservative and never authorizes cutover.
const roots=['src','worker'];const matches=[];
function walk(dir){if(!fs.existsSync(dir))return;for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())walk(file);else if(/\.(?:ts|tsx|js|mjs)$/.test(file)){const text=fs.readFileSync(file,'utf8');const lines=text.split(/\r?\n/);for(let i=0;i<lines.length;i++)if(/\b(?:db\(\)|dbHealth\(\)|withDatabaseScope\(|postgres\(|sql\`|\.unsafe\()/.test(lines[i]))matches.push({file:file.replaceAll('\\','/'),line:i+1,kind:/withDatabaseScope/.test(lines[i])?'scope':/dbHealth/.test(lines[i])?'health':/postgres\(/.test(lines[i])?'postgres': 'query-or-client'});}}}
for(const root of roots)walk(root);
const byFile=Object.entries(Object.groupBy(matches,x=>x.file)).map(([file,items])=>({file,occurrences:items.length})).sort((a,b)=>b.occurrences-a.occurrences);
const report={kind:'STATIC_POSTGRES_RUNTIME_DEPENDENCY_INVENTORY',files:byFile,matches:matches.length,d1CutoverAuthorized:false,warning:'Heuristic code scan; requires manual query-level review and actual runtime contract testing'};
console.log(JSON.stringify(report,null,2));
if(process.argv.includes('--require-zero')&&matches.length)process.exitCode=1;
