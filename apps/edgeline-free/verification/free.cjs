const fs=require('fs'), vm=require('vm'),ts=require('typescript'),assert=require('assert/strict');
function mod(file,extras={}) { const exports={}; vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Map,Set,Date,Math,Number,String,JSON,Array,Object,Error,Promise,Response,Request,URL,URLSearchParams,AbortSignal,...extras});return exports; }
(async()=>{
 const r=mod('lib/research.ts');
 const header='Date,Time,HomeTeam,AwayTeam,FTHG,FTAG,FTR,B365H,B365D,B365A\n';
 const rows=Array.from({length:70},(_,i)=>{const d=new Date(Date.UTC(2025,0,i+1));return `${String(d.getUTCDate()).padStart(2,'0')}/${String(d.getUTCMonth()+1).padStart(2,'0')}/2025,12:00,A,B,2,1,H,2,3,4`;});
 const original=r.buildHistory(header+rows.join('\n'),'E0','2526');
 const changed=r.buildHistory(header+[...rows.slice(0,69),rows[69].replace(',2,1,H,',',0,5,A,')].join('\n'),'E0','2526');
 assert.deepEqual(original.map(g=>g.poisson),changed.map(g=>g.poisson),'a result cannot change its own or earlier predictions');
 assert.ok(original[69].poisson);assert.equal(original[69].trainingGames,69);
 const duplicate=r.buildHistory(header+[...rows,rows[0]].join('\n'),'E0','2526');assert.equal(duplicate.length,70);
 let fetched=0;const cache=new Map();
 const worker=mod('worker/index.ts',{require:()=>({getCoverage:async()=>[],getCoverageEvents:async()=>({events:[],error:null})}),caches:{default:{match:async k=>cache.get(k.url)?.clone(),put:async(k,v)=>cache.set(k.url,v)}},fetch:async()=>{fetched++;return new Response(header+rows.join('\n'));}}).default;
 const env={PAID_ODDS_ENABLED:'false',D1_SPORTS_MARKET_ARCHIVE_ENABLED:'false',ATLAS_SCHEDULE_EXECUTION_ENABLED:'false'},ctx={waitUntil:p=>p};
 const call=(path,method='GET')=>worker.fetch(new Request('https://test.example'+path,{method}),env,ctx);
 const health=await(await call('/api/monitoring')).json(); assert.equal(health.paidOddsEnabled,false);assert.equal(health.archiveWritesEnabled,false);assert.equal(health.scheduledExecutionEnabled,false);
 assert.equal((await call('/api/research/csv?league=bad&season=2627')).status,400);assert.equal(fetched,0);
 assert.equal((await call('/api/research/csv?league=E0&season=2627','POST')).status,405);
 await call('/api/research/csv?league=E0&season=2627');await call('/api/research/csv?league=E0&season=2627');assert.equal(fetched,1);
 assert.equal((await call('/api/live-state')).status,503);assert.equal(fetched,1);
 console.log('PASS: earlier-only learning, result correction, deduplication, disabled collection, safe flags, endpoint validation, cache reuse.');
})().catch(e=>{console.error(e);process.exitCode=1;});
