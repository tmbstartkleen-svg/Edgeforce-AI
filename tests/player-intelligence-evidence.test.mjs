import test from 'node:test';import assert from 'node:assert/strict';
import {auditPlayerIntelligence} from '../src/lib/intelligence-core/player-intelligence-evidence.mjs';
test('player data gate rejects stale, missing identity, and duplicate evidence',()=>{
 const now=Date.parse('2026-10-19T21:00:00Z');
 const a={kind:'injury',providerId:'p',upstreamId:'u',eventId:'e',athleteId:'a',observedAt:'2026-10-19T20:59:00Z'};
 const out=auditPlayerIntelligence([a,a,{...a,kind:'lineup',observedAt:'2026-10-17T20:59:00Z'},
  {...a,kind:'prop',athleteId:''},{...a,kind:'player-stat',providerId:''}],{now});
 assert.equal(out.accepted,1);assert.equal(out.duplicates,1);assert.equal(out.stale,1);
 assert.equal(out.missingIdentity,1);assert.equal(out.missingSource,1);
 assert.equal(out.betRecommendationAuthorized,false);assert.equal(out.propOddsVerified,false);
});
