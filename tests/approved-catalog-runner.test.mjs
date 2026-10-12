import test from 'node:test';
import assert from 'node:assert/strict';
import {runApprovedCatalogProbe} from '../src/lib/intelligence-core/approved-catalog-runner.mjs';
const approved={sourceId:'polymarket-gamma',upstreamId:'polymarket',enabled:true,licenseApproved:true,permissionScope:'READ_PUBLIC_API'};
test('bounded public event collection remains explicitly unclassified and unstored',async()=>{
 const x=await runApprovedCatalogProbe({source:approved,fetchImpl:async()=>({ok:true,headers:{get:()=>null},text:async()=>JSON.stringify([{id:'123',title:'CPI release',active:true,closed:false,markets:[]}])})});
 assert.equal(x.count,1);assert.equal(x.status,'OBSERVED_NOT_PERSISTED');assert.equal(x.storedInD1,false);
 assert.equal(x.items[0].division,'UNCLASSIFIED');
});
test('requires approved source and public API scope',async()=>{
 await assert.rejects(runApprovedCatalogProbe({source:{...approved,enabled:false}}),/SOURCE_NOT_APPROVED/);
 await assert.rejects(runApprovedCatalogProbe({source:{...approved,permissionScope:'SCRAPE_PRIVATE'}}),/SOURCE_NOT_APPROVED/);
});
