import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const compile=path=>ts.transpileModule(readFileSync(new URL('../'+path,import.meta.url),'utf8'),{
 compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}
}).outputText;
const uri=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
const evidenceUri=uri(compile('src/lib/pulseEvidence.ts'));
const {evaluatePulseEvidence,isPulseAmericanPrice}=await import(evidenceUri);
const baseline=Date.parse('2026-11-25T12:00:00Z');
const iso=n=>new Date(n).toISOString();
const row={sport:'NBA',fixture:'fixture-123',market:'moneyline',status:'OPEN',inplay:false,
 updatedAt:iso(baseline-10000),prices:[{selectionId:'selection-1',american:-110},{selectionId:'selection-2',american:105}]};
const pulse={ok:true,fresh:true,generatedAt:iso(baseline-30000),rows:[row]};

test('pulse evidence accepts current OPEN prices without asserting mapped outcomes',()=>{
 const result=evaluatePulseEvidence(pulse,baseline);
 assert.equal(result.usable,true);assert.equal(result.fresh,true);assert.equal(result.ageMs,30000);
 assert.equal(result.priceCount,2);assert.equal(result.rowCount,1);
 assert.equal(result.rows[0].prices[0].selectionId,'selection-1');
 assert.equal(result.rows[0].sourceAgeMs,10000);
 assert.equal(result.reason,null);
 assert.equal('modelProbability' in result,false);
});

test('missing and coerced numbers never count as American prices',()=>{
 for(const value of [undefined,null,false,true,'110','',[],{},NaN,Infinity,-Infinity,0,99,-99]){
  assert.equal(isPulseAmericanPrice(value),false,String(value));
 }
 for(const value of [-110,-100,100,105,110.5])assert.equal(isPulseAmericanPrice(value),true);
 const prices=[null,'110',0,false,99,110].map((american,index)=>({selectionId:'s'+index,american}));
 const result=evaluatePulseEvidence({...pulse,rows:[{...row,prices}]},baseline);
 assert.equal(result.priceCount,1);assert.equal(result.rejectedPrices,5);
});

test('snapshot and row clocks must be zoned, nonfuture and no more than two minutes old',()=>{
 for(const generatedAt of [undefined,null,'invalid','2026-11-25T12:00:00',iso(baseline+1),iso(baseline-120001)]){
  const result=evaluatePulseEvidence({...pulse,generatedAt},baseline);
  assert.equal(result.fresh,false,String(generatedAt));assert.equal(result.usable,false);assert.equal(result.priceCount,0);
 }
 for(const updatedAt of [undefined,null,'invalid','2026-11-25T12:00:00',iso(baseline+1),iso(baseline-120001)]){
  const result=evaluatePulseEvidence({...pulse,rows:[{...row,updatedAt}]},baseline);
  assert.equal(result.fresh,true);assert.equal(result.usable,false,String(updatedAt));assert.equal(result.rejectedRows,1);
 }
 assert.equal(evaluatePulseEvidence({...pulse,generatedAt:iso(baseline-120000),rows:[{...row,updatedAt:iso(baseline-120000)}]},baseline).usable,true);
 assert.equal(evaluatePulseEvidence(pulse,NaN).usable,false);
});

test('closed or unknown markets, missing identifiers and stale transport cannot qualify',()=>{
 for(const status of ['CLOSED','SUSPENDED','UNKNOWN','open',undefined]){
  assert.equal(evaluatePulseEvidence({...pulse,rows:[{...row,status,inplay:true}]},baseline).usable,false,String(status));
 }
 for(const patch of [{fixture:''},{market:''},{prices:[{selectionId:'',american:-110}]}]){
  assert.equal(evaluatePulseEvidence({...pulse,rows:[{...row,...patch}]},baseline).usable,false);
 }
 assert.equal(evaluatePulseEvidence({...pulse,ok:false},baseline).usable,false);
 assert.equal(evaluatePulseEvidence({...pulse,fresh:false},baseline).usable,false);
});

test('local time expiration removes eligibility without another fetch',()=>{
 assert.equal(evaluatePulseEvidence(pulse,baseline+90000).usable,true);
 assert.equal(evaluatePulseEvidence(pulse,baseline+90001).usable,false);
});

let moduleNumber=0;
async function loadClient(){
 const source=compile('src/lib/providers/fanLineWire.ts')
  .replaceAll("from '../pulseEvidence'","from "+JSON.stringify(evidenceUri));
 return import(uri(source)+'#pulse-client-'+(++moduleNumber));
}
const rawPayload=()=>({generated_at:iso(baseline-30000),sequence:1,live:{total:0},prematch:{total:1},
 fixtures:[{sport:'NBA',fixture:'fixture-123',market:'moneyline',status:'OPEN',inplay:false,
  updated_at:iso(baseline-10000),prices:[{selection_id:'selection-1',american:-110}]}]});
const response=payload=>({ok:true,status:200,json:async()=>payload});

test('forced pulse refreshes share one request and respect the minimum interval',async t=>{
 let now=baseline,requests=0,resolve;
 t.mock.method(Date,'now',()=>now);
 t.mock.method(globalThis,'fetch',()=>{requests++;return new Promise(done=>{resolve=done})});
 const {fetchFanDuelOddsPulse}=await loadClient();
 const first=fetchFanDuelOddsPulse(true),second=fetchFanDuelOddsPulse(true),third=fetchFanDuelOddsPulse();
 assert.equal(requests,1);resolve(response(rawPayload()));
 const results=await Promise.all([first,second,third]);
 assert.ok(results.every(value=>value.fresh));assert.equal(requests,1);
 now+=5000;
 const cached=await fetchFanDuelOddsPulse(true);
 assert.equal(requests,1);assert.equal(cached.ageMs,35000);
 now+=5000;
 const next=fetchFanDuelOddsPulse(true);assert.equal(requests,2);resolve(response(rawPayload()));await next;
});

test('cached pulse age advances and expires even inside a long configured cache',async t=>{
 let now=baseline,requests=0;
 const prior=process.env.FANLINEWIRE_CACHE_MS;process.env.FANLINEWIRE_CACHE_MS='300000';
 t.after(()=>{if(prior===undefined)delete process.env.FANLINEWIRE_CACHE_MS;else process.env.FANLINEWIRE_CACHE_MS=prior});
 t.mock.method(Date,'now',()=>now);
 t.mock.method(globalThis,'fetch',async()=>{requests++;return response(rawPayload())});
 const {fetchFanDuelOddsPulse}=await loadClient();
 assert.equal((await fetchFanDuelOddsPulse()).fresh,true);
 now+=91000;
 const stale=await fetchFanDuelOddsPulse();
 assert.equal(requests,1);assert.equal(stale.ageMs,121000);assert.equal(stale.fresh,false);
 assert.equal(evaluatePulseEvidence(stale,now).usable,false);
});

test('pulse parsing preserves invalid prices as missing and rejects a future snapshot',async t=>{
 const payload=rawPayload();payload.generated_at=iso(baseline+1000);
 payload.fixtures[0].prices=[null,'110',false,'',-110].map((american,index)=>({selection_id:'s'+index,american}));
 t.mock.method(Date,'now',()=>baseline);
 t.mock.method(globalThis,'fetch',async()=>response(payload));
 const {fetchFanDuelOddsPulse}=await loadClient();
 const result=await fetchFanDuelOddsPulse();
 assert.deepEqual(result.rows[0].prices.map(price=>price.american),[null,null,null,null,-110]);
 assert.equal(result.fresh,false);assert.equal(result.ageMs,null);
});

test('failed refresh retains a stale snapshot and does not burst forced retries',async t=>{
 let now=baseline,requests=0;
 t.mock.method(Date,'now',()=>now);
 t.mock.method(globalThis,'fetch',async()=>{requests++;if(requests>1)throw Error('offline');return response(rawPayload())});
 const {fetchFanDuelOddsPulse}=await loadClient();
 await fetchFanDuelOddsPulse();now+=11000;
 const fallback=await fetchFanDuelOddsPulse(true);
 assert.equal(fallback.fresh,false);assert.equal(fallback.ageMs,41000);assert.equal(requests,2);
 const repeated=await fetchFanDuelOddsPulse(true);
 assert.equal(requests,2);assert.equal(repeated.fresh,false);assert.equal(evaluatePulseEvidence(repeated,now).usable,false);
});
