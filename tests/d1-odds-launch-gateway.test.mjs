import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const text=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const compile=p=>ts.transpileModule(text(p),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const uri=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const policy=uri(compile('src/lib/stage1-odds-source-registry-audit.ts'));
const auth=uri(compile('src/lib/firstPartySportsNetwork.ts'));
const gateway=compile('worker/d1-odds-launch-gateway.ts')
 .replace("from '../src/lib/firstPartySportsNetwork'","from "+JSON.stringify(auth))
 .replace("from '../src/lib/stage1-odds-source-registry-audit'","from "+JSON.stringify(policy));
const {d1OddsLaunchReadiness}=await import(uri(gateway));
const secret='12345678901234567890123456789012';
const endpoint='https://example.invalid/api/operations/d1-pilot/odds-launch-readiness';
const request=(method='GET',authorization='Bearer '+secret)=>new Request(endpoint,{method,headers:{authorization}});
const items=Array.from({length:16},(_,i)=>({source_id:'score-'+i,upstream_id:'site.api.espn.com',source_type:'scoreboard',enabled:1}));
items.push({source_id:'cert',upstream_id:'example',source_type:'CERTIFICATION_ONLY',enabled:0});
function env(rows=items,count=0){
 const queries=[];
 return {CRON_SECRET:secret,INTELLIGENCE_DB:{prepare(sql){
  queries.push(sql);
  if(sql.startsWith('SELECT source_id,upstream_id,source_type,enabled'))
   return {all:async()=>({results:rows})};
  if(sql.includes('SELECT COUNT(*) AS count'))
   return {first:async()=>({count})};
  throw Error('UNEXPECTED_QUERY');
 }},queries};
}
test('authenticated source inventory reveals zero stored odds, not falsely enabled feeds',async()=>{
 const e=env();
 const r=await d1OddsLaunchReadiness(request(),e);
 const body=await r.json();
 assert.equal(r.status,200);
 assert.match(r.headers.get('Cache-Control'),/no-store/);
 assert.equal(body.ok,true);
 assert.equal(body.totalRegistered,17);
 assert.equal(body.enabledSportsbookSources,0);
 assert.equal(body.storedOddsRows,0);
 assert.equal(body.releaseCertified,false);
 assert.equal(body.productionCertified,false);
 assert.equal(body.verifiedValueBets,0);
 assert.ok(body.blockers.includes('NO_ENABLED_SPORTSBOOK_ODDS_SOURCE'));
 assert.equal(body.candidates,undefined);
 assert.equal(e.queries.length,2);
});
test('missing authorization blocks all database access',async()=>{
 const e=env();
 const r=await d1OddsLaunchReadiness(request('GET','Bearer incorrect'),e);
 assert.equal(r.status,401);
 assert.equal(e.queries.length,0);
});
test('method and missing binding fail closed',async()=>{
 assert.equal((await d1OddsLaunchReadiness(request('POST'),env())).status,405);
 assert.equal((await d1OddsLaunchReadiness(request(),{CRON_SECRET:secret})).status,503);
});
test('incomplete registry result, query saturation or invalid stored row count cannot certify',async()=>{
 assert.equal((await d1OddsLaunchReadiness(request(),env(items,NaN))).status,503);
 assert.equal((await d1OddsLaunchReadiness(request(),env(Array(1001).fill(items[0]),0))).status,503);
});
test('this gateway is bounded and read-only and is mounted in Worker',()=>{
 const index=text('worker/index.ts');
 assert.match(index,/odds-launch-readiness/);
 assert.match(index,/d1OddsLaunchReadiness\(request,env\)/);
 assert.doesNotMatch(gateway,/INSERT INTO|UPDATE intelligence_|DELETE FROM|fetch\(|writeFile\(/);
});
