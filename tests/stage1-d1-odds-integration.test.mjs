import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const compile=(file)=>ts.transpileModule(readFileSync(new URL('../'+file,import.meta.url),'utf8'),
 {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const uri=(code)=>'data:text/javascript;base64,'+Buffer.from(code).toString('base64');
const planner=uri(readFileSync(new URL('../src/lib/intelligence-core/agent-planner.mjs',import.meta.url),'utf8'));
const writerCode=compile('worker/d1-observations.ts')
 .replace("from '../src/lib/intelligence-core/agent-planner.mjs'","from "+JSON.stringify(planner));
const {appendD1Observations}=await import(uri(writerCode));
const verification=uri(compile('src/lib/d1-odds-readback-verification.ts'));
const readbackCode=compile('src/lib/d1-odds-readback-adapter.ts')
 .replace("from './d1-odds-readback-verification'","from "+JSON.stringify(verification));
const {readAndVerifyD1OddsBatch}=await import(uri(readbackCode));

const now=Date.parse('2026-10-23T21:00:00Z');
const price={bookmaker:'DraftKings',sport:'basketball_nba',league:'NBA',
 marketType:'h2h',outcomeId:'HOME',startsAt:new Date(now+3600000).toISOString(),
 priceAmerican:-115};
const expected={provider:'the-odds-api',upstreamId:'api.the-odds-api.com',
 eventId:'event-one',marketId:'h2h',observedAt:now-30000,kind:'odds',value:price};

function memoryD1(sourceType='sportsbook-odds',enabled=1){
 const rows=[];const statements=[];let registryReads=0;
 return {rows,statements,get registryReads(){return registryReads},
  prepare(sql){
   const entry={sql,args:[]};statements.push(entry);
   const chain={
    bind(...args){entry.args=args;return this},
    async first(){
     if(!sql.includes('FROM intelligence_sources'))throw Error('UNEXPECTED_REGISTRY_QUERY');
     registryReads++;
     return enabled?{upstream_id:'api.the-odds-api.com',source_type:sourceType}:null;
    },
    async run(){
     if(!/^INSERT OR IGNORE INTO intelligence_observations/.test(sql))throw Error('UNEXPECTED_WRITE');
     const args=entry.args;
     const row={source_id:args[0],upstream_id:args[1],event_id:args[2],
      market_id:args[3],observation_kind:args[4],observed_at:args[5],
      payload_hash:args[6],payload:args[7]};
     if(rows.some(x=>x.payload_hash===row.payload_hash&&x.event_id===row.event_id&&
      x.observed_at===row.observed_at))return {meta:{changes:0}};
     rows.push(row);return {meta:{changes:1}};
    },
    async all(){
     if(!/^SELECT o.source_id/.test(sql))throw Error('UNEXPECTED_READBACK_QUERY');
     if(!sql.includes("s.source_type='sportsbook-odds'"))throw Error('ODDS_READBACK_SOURCE_TYPE_NOT_RESTRICTED');
     if(sourceType!=='sportsbook-odds'||!enabled)return {results:[]};
     const args=entry.args,begin=Date.parse(args.at(-1));
     return {results:rows.filter(row=>row.source_id===args[0]&&row.upstream_id===args[1]&&
      args.slice(2,-1).includes(row.event_id)&&Date.parse(row.observed_at)>=begin)
      .map(({payload_hash,...rest})=>rest)};
    }
   };return chain;
  }
 };
}
test('authorized-type mock D1 writer and exact readback form a complete non-certifying cycle',async()=>{
 const db=memoryD1();
 const write=await appendD1Observations(db,[expected],now);
 assert.equal(write.accepted,1);assert.equal(write.rejected,0);
 assert.equal(db.rows.length,1);
 const read=await readAndVerifyD1OddsBatch(db,[expected],now);
 assert.equal(read.exactReadbackComplete,true);
 assert.equal(read.readbackMatches,1);
 assert.equal(read.sourceEntitlementVerified,false);
 assert.equal(read.authenticatedCollectionVerified,false);
 assert.equal(read.releaseCertified,false);
 assert.equal(read.writesPerformed,0);
 const repeat=await appendD1Observations(db,[expected],now);
 assert.equal(repeat.duplicates,1);
});
test('a scoreboard registry cannot be used for odds even if source ID looks like an odds provider',async()=>{
 const db=memoryD1('scoreboard');
 const result=await appendD1Observations(db,[expected],now);
 assert.equal(result.accepted,0);assert.equal(result.rejected,1);
 assert.ok(result.reasons.includes('SOURCE_TYPE_NOT_AUTHORIZED_FOR_ODDS'));
 assert.equal(db.rows.length,0);
 assert.equal((await readAndVerifyD1OddsBatch(db,[expected],now)).exactReadbackComplete,false);
});
test('disabled registry cannot persist odds even if source type is correct',async()=>{
 const db=memoryD1('sportsbook-odds',0);
 const report=await appendD1Observations(db,[expected],now);
 assert.equal(report.accepted,0);
 assert.ok(report.reasons.includes('D1_SOURCE_NOT_APPROVED'));
});
test('provisional name-only player ID is never written to sportsbook odds D1',async()=>{
 const db=memoryD1();
 const prop={...expected,marketId:'player_points',value:{...price,marketType:'player_points',
  playerId:'name:example player',playerIdentityStatus:'UNVERIFIED_NAME_ONLY',
  line:'22.5',outcomeId:'Over'}};
 const result=await appendD1Observations(db,[prop],now);
 assert.equal(result.accepted,0);
 assert.ok(result.reasons.includes('UNVERIFIED_PLAYER_IDENTITY_CANNOT_PERSIST'));
 assert.equal(db.rows.length,0);
});
test('tampering with a persisted price fails exact D1 quote verification',async()=>{
 const db=memoryD1();
 assert.equal((await appendD1Observations(db,[expected],now)).accepted,1);
 db.rows[0].payload=JSON.stringify({...price,priceAmerican:-120});
 const report=await readAndVerifyD1OddsBatch(db,[expected],now);
 assert.equal(report.exactReadbackComplete,false);
 assert.equal(report.rejected.EXPECTED_QUOTE_MISSING,1);
});
test('D1 integration suite does not connect to real Cloudflare or paid API',()=>{
 const sources=['worker/d1-observations.ts','src/lib/d1-odds-readback-adapter.ts'];
 for(const path of sources)assert.doesNotMatch(compile(path),/api\.the-odds-api\.com\/v4|wrangler deploy/);
});
