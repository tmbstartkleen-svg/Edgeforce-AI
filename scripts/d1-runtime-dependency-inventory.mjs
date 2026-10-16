import fs from 'node:fs';
import path from 'node:path';
// Conservative audit only. D1 cutover stays blocked until runtime parity is proven.
const roots=['src','worker'];const matches=[];
function walk(dir){
 if(!fs.existsSync(dir))return;
 for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  const file=path.join(dir,entry.name);
  if(entry.isDirectory()){if(!['node_modules','.next','dist'].includes(entry.name))walk(file);continue;}
  if(!/\.(?:ts|tsx|js|mjs)$/.test(file))continue;
  const lines=fs.readFileSync(file,'utf8').split(/\r?\n/);
  const normalized=file.replaceAll('\\','/');
  for(let i=0;i<lines.length;i++){
   const line=lines[i];
   // db imported from src/lib/db may be aliased; flag file-level import even if calls are obscure.
   let kind=null;
   if(/\bfrom\s*['"][^'"]*(?:\/lib\/db|\.\/db)['"]/.test(line)||/\brequire\(['"][^'"]*(?:\/lib\/db|\.\/db)['"]\)/.test(line))kind='database-import';
   else if(/\b(?:db\s*\(|dbHealth\s*\(|withDatabaseScope\s*\(|postgres\s*\(|sql\s*`|\.unsafe\s*\()/.test(line))kind='query-or-client';
   else if(/\b(?:DATABASE_URL|POSTGRES_URL|POSTGRES_PRISMA_URL|NEON_DATABASE_URL)\b/.test(line))kind='connection-config';
   if(kind)matches.push({file:normalized,line:i+1,kind});
  }
 }
}
for(const root of roots)walk(root);
const byFile=Object.entries(Object.groupBy(matches,x=>x.file)).map(([file,items])=>({file,occurrences:items.length,kinds:[...new Set(items.map(x=>x.kind))].sort()})).sort((a,b)=>b.occurrences-a.occurrences);
const report={kind:'STATIC_POSTGRES_RUNTIME_DEPENDENCY_INVENTORY',files:byFile,matches:matches.length,d1CutoverAuthorized:false,warning:'Conservative scan; imports, dynamic SQL, and query-level equivalence require manual review and runtime tests'};
console.log(JSON.stringify(report,null,2));
if(process.argv.includes('--require-zero')&&matches.length)process.exitCode=1;
