const fs=require('fs'),vm=require('vm'),ts=require('typescript'),assert=require('assert/strict'),path=require('path');
const modules=new Map();let clock=Date.UTC(2026,9,28,12);class Clock extends Date{constructor(...v){super(...(v.length?v:[clock]));}static now(){return clock;}}
let oddsCalls=0,catalogCalls=0,remaining=500;
const event=()=>({id:'e',sport_title:'Test',sport_key:'basketball_nba',home_team:'Home',away_team:'Away',commence_time:new Date(clock+86400000).toISOString(),bookmakers:['draftkings','fanduel'].map((key,i)=>({key,last_update:new Date(clock).toISOString(),markets:[{key:'h2h',outcomes:[{name:'Home',price:i?-130:110},{name:'Away',price:i?110:-130}]}]}))});
async function fetchMock(url){if(url.includes('/sports?')){catalogCalls++;return Response.json([{key:'basketball_nba',active:true,title:'NBA'}],{headers:{'x-requests-remaining':String(remaining)}});}oddsCalls++;return Response.json([event()],{headers:{'x-requests-remaining':String(remaining-=3)}});}
function load(file){file=path.resolve(file);if(modules.has(file))return modules.get(file);const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:p=>load(path.resolve(path.dirname(file),p+'.ts')),Date:Clock,Map,Set,Math,Number,String,Boolean,JSON,Array,Object,Error,Promise,Response,Request,URL,URLSearchParams,AbortSignal,fetch:fetchMock});modules.set(file,exports);return exports;}
function context(){const db=new Map();let queue=Promise.resolve();return {db,storage:{sql:{exec(query,...args){if(query.startsWith('SELECT'))return db.has(args[0])?[{value:db.get(args[0])}]:[];if(query.startsWith('INSERT'))db.set(args[0],args[1]);return [];}}},blockConcurrencyWhile(job){const p=queue.then(job);queue=p.catch(()=>{});return p;}};}
(async()=>{
 const {FreeOdds}=load('worker/odds.ts'),ctx=context(),env={FREE_ODDS_ENABLED:'true',THE_ODDS_API_KEY:'test-only-placeholder'},obj=new FreeOdds(ctx,env);
 const call=p=>obj.fetch(new Request('https://test/'+p));
 await Promise.all(Array.from({length:10},()=>call('state')));assert.equal(oddsCalls,1,'concurrent readers spend once');
 let data=await(await call('state')).json();assert.equal(data.events.length,1);assert.equal(data.quotes.length,2);assert.equal(data.arbitrage.length,1);assert.equal(data.feed.creditsReserved,3);
 await call('refresh');assert.equal(oddsCalls,1,'cooldown enforced');
 const fallback=await(await call('refresh?sport=basketball_nba')).json();assert.equal(fallback.events.length,1);assert.equal(fallback.feed.sport,'upcoming','blocked league switch preserves previous data');
 clock+=31*60000;await call('refresh');clock+=31*60000;await call('refresh');clock+=31*60000;await call('refresh');assert.equal(oddsCalls,3,'three daily refreshes maximum');
 const restarted=new FreeOdds(ctx,env);await restarted.fetch(new Request('https://test/refresh'));assert.equal(oddsCalls,3,'limits survive restart');
 const b=JSON.parse(ctx.db.get('budget'));b.calls=0;b.used=300;ctx.db.set('budget',JSON.stringify(b));await call('refresh');assert.equal(oddsCalls,3,'monthly ceiling');
 b.used=0;ctx.db.set('budget',JSON.stringify(b));remaining=5;await call('refresh');assert.equal(oddsCalls,3,'provider reserve');
 const scan=load('lib/arbitrage.ts').scanArbitrage,e=event();e.bookmakers[1].markets[0].outcomes.push({name:'Draw',price:300});assert.equal(scan([e]).length,0,'mismatched outcome universes excluded');
 const stale=event();stale.bookmakers.forEach(b=>b.last_update=new Date(clock-6*60000).toISOString());assert.equal(scan([stale]).length,0,'stale arbitrage excluded');
 const bad=event();bad.bookmakers[0].markets[0].outcomes[0].price=null;assert.equal(scan([bad]).length,0,'invalid prices excluded');
 console.log('PASS: concurrent quota reservations, persistent limits, cooldown, provider reserve, real feed normalization, matched arbitrage and stale/invalid rejection.');
})().catch(e=>{console.error(e);process.exitCode=1;});
