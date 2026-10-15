import fs from 'node:fs';

// A proposed D1 primary is not a completed migration. Fail closed until
// production repositories, migrations, health and rollback are certified.
const requested=(process.env.EDGEFORCE_PRIMARY_STORAGE||'postgres').toLowerCase();
const read=path=>fs.readFileSync(path,'utf8');
const worker=read('worker/index.ts');
const db=read('src/lib/db.ts');
const wrangler=JSON.parse(read('wrangler.jsonc'));
const d1Bound=wrangler.d1_databases?.some(x=>x.binding==='INTELLIGENCE_DB')===true;
const postgresRuntime=db.includes("import postgres from 'postgres'")&&worker.includes('withDatabaseScope');
const result={requestedPrimary:requested,neonRoleRequested:'secondary',d1Bound,
  postgresRuntime, d1FullApplicationReady:false, safeToPromote:false,
  reason:'D1 pilot does not yet implement all production PostgreSQL persistence contracts'};
if(!['postgres','d1'].includes(requested)){
 console.error(JSON.stringify({...result,reason:'UNKNOWN_PRIMARY_STORAGE'}));process.exit(1);
}
if(!d1Bound||!postgresRuntime){
 console.error(JSON.stringify({...result,reason:'STORAGE_TOPOLOGY_INVARIANT_MISSING'}));process.exit(1);
}
if(requested==='d1'){
 console.error(JSON.stringify(result));process.exit(1);
}
console.log(JSON.stringify({...result,safeToPromote:true,reason:'CURRENT_POSTGRES_RUNTIME_UNCHANGED'}));
