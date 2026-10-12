import test from 'node:test';import assert from 'node:assert/strict';
import {probePolymarketEvents} from '../src/lib/intelligence-core/polymarket-source.mjs';
const response=(items)=>({ok:true,headers:{get:()=>null},text:async()=>JSON.stringify(items)});
test('fetches bounded real-source-shaped records without claiming sports classification or D1 writes',async()=>{
 let called='';
 const result=await probePolymarketEvents({fetchImpl:async url=>{called=url;return response([{id:'123',title:'Federal funds rate',active:true,closed:false,markets:[]}])}});
 assert.match(called,/gamma-api\.polymarket\.com\/events/);
 assert.equal(result.items[0].division,'UNCLASSIFIED');
 assert.equal(result.storedInD1,false);
 assert.equal(result.validatedLicenseForReuse,false);
});
test('blocks oversized and malformed upstream responses',async()=>{
 await assert.rejects(probePolymarketEvents({fetchImpl:async()=>response([null])}),/POLYMARKET_INVALID_EVENT/);
 await assert.rejects(probePolymarketEvents({fetchImpl:async()=>({ok:false})}),/POLYMARKET_UPSTREAM_UNAVAILABLE/);
});
