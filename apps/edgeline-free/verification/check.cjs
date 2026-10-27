const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
function moduleFrom(file, fetch) {
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(output, { exports, fetch, Date, Map, Set, Number, String, JSON, Array, Boolean, Error, Promise, Intl, encodeURIComponent, AbortSignal });
  return exports;
}
let calls = [];
const fetchMock = async url => {
  calls.push(url);
  if (url.includes('/series?')) return {ok:true,json:async()=>({series:[{ticker:'GAME', title:'Basketball game', tags:['Basketball']}]})};
  if (url.endsWith('/sports')) return {ok:true,json:async()=>[{id:1, sport:'test', primaryTagId:42}]};
  if (url.includes('cursor=next')) return {ok:true,json:async()=>({events:[{id:'second', title:'Second', markets:[]}], next_cursor:null})};
  if (url.includes('series_ticker')) return {ok:false,status:429};
  return {ok:true,json:async()=>({events:[null,{id:'one',gameId:1,startTime:'2099-01-01T00:00:00Z',markets:[null,{id:1,active:true,outcomes:'["A","B","C","D"]',outcomePrices:'[false,"",0,1]',updatedAt:'bad'}]},{id:'one',markets:[]},{id:'closed',closed:true},{id:'old',gameId:2,startTime:'2000-01-01T00:00:00Z'},{id:'ended',ended:true,live:true},{id:'live',live:true}],next_cursor:'next'})};
};
(async () => {
  const api=moduleFrom('backend/coverage.ts',fetchMock);
  const page=await api.getCoverageEvents('Polymarket','1');
  assert.equal(page.error,null);assert.equal(page.events.length,4);
  assert.deepEqual(Array.from(page.events,e=>e.state),['Scheduled','Game status unverified','Ended · settlement pending','Provider reports live']);
  assert.equal(page.events[0].markets[0].prices,'A unavailable · B unavailable · C 0.0¢ · D 100.0¢');
  assert.equal(page.events[0].markets[0].updatedAt,null);
  assert.equal(page.nextCursor,'next');assert.equal(await api.getCoverageEvents('Polymarket','1'),page);
  const next=await api.getCoverageEvents('Polymarket','1','next');assert.equal(next.events[0].id,'second');assert.equal(next.more,false);
  assert.ok(calls.some(url=>url.includes('after_cursor=next')));
  assert.match((await api.getCoverageEvents('Kalshi','GAME')).error,/429/);
  const before=calls.length;assert.ok((await api.getCoverageEvents('Unknown','1')).error);assert.equal(calls.length,before);
  const time=moduleFrom('lib/eastern-time.ts');
  assert.equal(time.easternDay('2026-10-27T02:00:00Z'),'2026-10-26');
  assert.equal(time.easternPeriod('2026-10-27T02:00:00Z'),'Evening');
  assert.equal(time.easternPeriod('2026-11-01T05:30:00Z'),'Overnight');
  assert.equal(time.easternPeriod('2026-11-01T06:30:00Z'),'Overnight');
  const math=moduleFrom('lib/hedge-math.ts');assert.equal(math.americanToDecimal(-400),1.25);assert.equal(math.americanToDecimal(-200),1.5);assert.equal(math.americanToDecimal(NaN),null);
  const plan=math.calculateLastLegCoverage(10,400,[{id:'other',selection:'Other',americanOdds:100}]);
  assert.equal(plan.equalizedNet,15);assert.equal(plan.hedges[0].stake,25);
  console.log('PASS: pagination, deduplication, malformed prices/dates, event states, cache, failure handling, invalid requests, Eastern midnight/DST and odds/hedge arithmetic.');
})().catch(error=>{console.error(error);process.exitCode=1;});
