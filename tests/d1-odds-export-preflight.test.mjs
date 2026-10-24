import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const compile=p=>ts.transpileModule(read(p),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const uri=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const auth=uri(compile('src/lib/firstPartySportsNetwork.ts'));
const prep=uri(compile('src/lib/the-odds-api-d1-preparation.ts'));
const preflight=uri(compile('src/lib/odds-ingestion-preflight.ts')
 .replace("from './the-odds-api-d1-preparation'","from "+JSON.stringify(prep)));
const gateway=compile('worker/d1-odds-export-preflight.ts')
 .replace("from '../src/lib/firstPartySportsNetwork'","from "+JSON.stringify(auth))
 .replace("from '../src/lib/odds-ingestion-preflight'","from "+JSON.stringify(preflight));
const {d1OddsAuthorizedExportPreflight}=await import(uri(gateway));
const secret='12345678901234567890123456789012',url='https://edgeforce.invalid/api/operations/d1-pilot/odds-export-preflight';
const events=()=>[{id:'event-1',sport_key:'basketball_nba',sport_title:'NBA',
 commence_time:new Date(Date.now()+3600000).toISOString(),bookmakers:[{
 key:'draftkings',title:'DraftKings',last_update:new Date(Date.now()-30000).toISOString(),
 markets:[{key:'h2h',outcomes:[{name:'Home',price:-115},{name:'Away',price:105}]}]}]}];
const req=(body,authorization='Bearer '+secret,method='POST')=>new Request(url,{
 method,headers:{authorization,'Content-Type':'application/json'},body:method==='POST'?body:undefined});
const db=(source='scoreboard',enabled=1)=>{const queries=[];return {queries,prepare(sql){
 queries.push(sql);
 if(!sql.startsWith('SELECT source_id,upstream_id,source_type,enabled'))throw Error('NON_READ_ONLY_QUERY');
 return {bind(...args){assert.deepEqual(args,['the-odds-api']);return this},
  async first(){return {source_id:'the-odds-api',upstream_id:'api.the-odds-api.com',source_type:source,enabled}}};
}}};
const env=(database=db())=>({CRON_SECRET:secret,INTELLIGENCE_DB:database});
test('valid authorized export is mapped without granting sportsbook storage or provider authenticity',async()=>{
 const database=db('sportsbook-odds');const r=await d1OddsAuthorizedExportPreflight(req(JSON.stringify({events:events()})),env(database));
 assert.equal(r.status,200);
 const data=await r.json();
 assert.equal(data.ok,true);
 assert.equal(data.mode,'AUTHORIZED_EXPORT_REGISTRY_PREFLIGHT_NO_WRITE');
 assert.equal(data.registry.registrationEligible,true);
 assert.equal(data.preflight.targetQuoteCount,2);
 assert.equal(data.canPersist,false);
 assert.equal(data.writePerformed,false);
 assert.equal(data.providerRequests,0);
 assert.equal(data.productionApproved,false);
 assert.ok(data.blockers.includes('STORAGE_RIGHTS_NOT_INDEPENDENTLY_VERIFIED'));
 assert.equal(database.queries.length,1);
 assert.match(r.headers.get('Cache-Control'),/no-store/);
});
test('scoreboard row cannot authorize sportsbook ingestion',async()=>{
 const result=await d1OddsAuthorizedExportPreflight(req(JSON.stringify({events:events()})),env(db('scoreboard')));
 const data=await result.json();
 assert.equal(data.registry.registrationEligible,false);
 assert.ok(data.blockers.includes('NO_APPROVED_SPORTSBOOK_ODDS_REGISTRATION'));
});
test('bad auth, invalid body and wrong method cannot query D1',async()=>{
 const database=db('sportsbook-odds');const e=env(database);
 assert.equal((await d1OddsAuthorizedExportPreflight(req('{}','Bearer wrong'),e)).status,401);
 assert.equal((await d1OddsAuthorizedExportPreflight(req('{}','Bearer '+secret,'GET'),e)).status,405);
 assert.equal((await d1OddsAuthorizedExportPreflight(req('{}'),e)).status,400);
 assert.equal((await d1OddsAuthorizedExportPreflight(req('{bad'),e)).status,400);
 assert.equal(database.queries.length,0);
});
test('body limits, source-independent intent and no network invocation',async()=>{
 const tooLarge=JSON.stringify({events:events(),padding:'a'.repeat(524288)});
 assert.equal((await d1OddsAuthorizedExportPreflight(req(tooLarge),env())).status,413);
 assert.doesNotMatch(read('worker/d1-odds-export-preflight.ts'),/fetch\(|INSERT INTO|UPDATE intelligence_|DELETE FROM|writeFile\(/);
 assert.match(read('worker/index.ts'),/d1OddsAuthorizedExportPreflight\(request,env\)/);
});
