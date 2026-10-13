import test from 'node:test';import assert from 'node:assert/strict';import {probeProvider,probePublicProviders} from '../scripts/public-provider-probe-agent.mjs';
const p={id:'test',kind:'PREDICTION_EXCHANGE',url:'https://example.test/markets',arrayKey:'markets'};
test('probe validates actual array schema and never reports odds',async()=>{
 const r=await probeProvider(p,{fetcher:async()=>({ok:true,status:200,text:async()=>JSON.stringify({markets:[{ticker:'X'}]})}),now:()=>100});
 assert.equal(r.healthy,true);assert.equal(r.returnedRecords,1);
 const r2=await probeProvider(p,{fetcher:async()=>({ok:true,status:200,text:async()=>JSON.stringify({error:'invalid'})}),now:()=>100});
 assert.equal(r2.healthy,false);assert.equal(r2.reason,'SCHEMA_MISMATCH');
});
test('report marks public probes separate from sportsbook licensing and sports collection',async()=>{
 const report=await probePublicProviders({fetcher:async()=>({ok:true,status:200,text:async()=>JSON.stringify([])})});
 assert.equal(report.licensedSportsbookOdds,false);assert.equal(report.liveSportsCollectionEnabled,false);
 assert.equal(report.checks.length,2);
});
