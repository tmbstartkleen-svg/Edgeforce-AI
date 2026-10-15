import test from 'node:test';import assert from 'node:assert/strict';
import {certifySoccerRuntimeEvidence} from '../src/lib/intelligence-core/soccer-runtime-evidence.mjs';
const now=Date.parse('2026-10-14T20:00:00Z');
const markets=[{id:'m1',leagueId:'eng.1',eventId:'1',sourceBook:'DraftKings'}];
const scores=[{leagueId:'eng.1',eventId:'1',sourceApproved:true,observedAt:'2026-10-14T19:59:00Z'}];
const quotes=[{leagueId:'eng.1',eventId:'1',marketId:'m1',providerId:'opt',book:'DraftKings',licensed:true,providerApproved:true,observedAt:'2026-10-14T19:59:00Z'}];
const sources=[{providerId:'opt',upstreamId:'data.example',enabled:true,licenseVerified:true,providerApproved:true}];
test('unconfigured provider cannot unlock soccer selections',()=>{const x=certifySoccerRuntimeEvidence({markets,scores,quotes,now});assert.equal(x.approvedMarketCount,0)});
test('exact license, source and fresh quote required',()=>{const x=certifySoccerRuntimeEvidence({markets,scores,quotes,sources,now});assert.equal(x.approvedMarketCount,1);assert.equal(x.fullDraftKingsInventoryCertified,false)});
test('unlicensed provider cannot bypass readiness',()=>{const x=certifySoccerRuntimeEvidence({markets,scores,quotes,sources:[{...sources[0],licenseVerified:false}],now});assert.equal(x.approvedMarketCount,0)});

test('same market ID from an unapproved provider does not inherit license approval',()=>{
 const unapprovedQuote={...quotes[0],providerId:'rogue',book:'DraftKings'};
 const r=certifySoccerRuntimeEvidence({markets,scores,quotes:[unapprovedQuote],sources,now});
 assert.equal(r.approvedMarketCount,0);
});
test('stale licensed quote is rejected even when another provider shares market ID',()=>{
 const stale={...quotes[0],observedAt:'2026-10-14T19:49:00Z'};
 const unapprovedQuote={...quotes[0],providerId:'rogue'};
 const r=certifySoccerRuntimeEvidence({markets,scores,quotes:[stale,unapprovedQuote],sources,now});
 assert.equal(r.approvedMarketCount,0);
});
