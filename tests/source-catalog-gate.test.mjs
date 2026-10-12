import test from 'node:test';import assert from 'node:assert/strict';
import {planSourceCollection,qualifySource} from '../src/lib/intelligence-core/source-catalog-gate.mjs';
const now=Date.now();
const base={sourceId:'feed1',upstreamId:'owner1',division:'SPORTS',domain:'NFL',licenseApproved:true,enabled:true,permissionScope:'READ_PUBLIC_API',observedAt:now};
test('valid sports and independent non-sports sources are segregated',()=>{
 const plan=planSourceCollection({sources:[base,{...base,sourceId:'feed2',division:'PREDICTION_MARKETS',domain:'ECONOMICS'}],now});
 assert.equal(plan.sourceCount,2);assert.equal(plan.actualMarketsScanned,0);
 assert.equal(plan.mode,'PLAN_ONLY_NO_FETCH');
});
test('unapproved, stale and malformed sources are rejected',()=>{
 const p=planSourceCollection({sources:[{...base,licenseApproved:false},{...base,sourceId:'stale',observedAt:now-400000},{...base,sourceId:'wrong',division:'PREDICTION_MARKETS'}],now});
 assert.equal(p.sourceCount,0);assert.equal(p.rejected.length,3);
 assert.throws(()=>qualifySource({...base,permissionScope:'SCRAPE_PRIVATE'}),/SOURCE_SCOPE_NOT_APPROVED/);
});
