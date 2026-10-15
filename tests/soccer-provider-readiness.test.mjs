import test from 'node:test';import assert from 'node:assert/strict';import {assessSoccerProviderReadiness} from '../src/lib/intelligence-core/soccer-provider-readiness.mjs';
const now=Date.parse('2026-10-14T20:00:00Z');
const src={providerId:'licensed',upstreamId:'provider.example',enabled:true,licenseVerified:true,providerApproved:true};
const row={id:'1',sourceProviderId:'licensed',licensed:true,observedAt:'2026-10-14T19:59:00Z'};
test('no provider means no soccer market readiness',()=>{const r=assessSoccerProviderReadiness({now});assert.equal(r.ready,false);assert.equal(r.reason,'NO_APPROVED_LICENSED_UPSTREAM')});
test('unlicensed or stale sources cannot clear readiness',()=>{assert.equal(assessSoccerProviderReadiness({sources:[{...src,licenseVerified:false}],marketRows:[row],now}).ready,false);assert.equal(assessSoccerProviderReadiness({sources:[src],marketRows:[{...row,observedAt:'2026-10-14T19:40:00Z'}],now}).ready,false)});
test('valid explicit evidence clears provider readiness but not fixture coverage',()=>{const r=assessSoccerProviderReadiness({sources:[src],marketRows:[row],now});assert.equal(r.ready,true);assert.equal(r.fullDraftKingsInventoryCertified,false)});
