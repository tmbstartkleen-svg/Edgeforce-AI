import test from 'node:test';
import assert from 'node:assert/strict';
import {SPORT_DOMAINS,NON_SPORTS_MARKETS,SPECIALIST_AGENTS,routeSpecialistTask,specialistNetworkManifest} from '../src/lib/intelligence-core/specialist-network.mjs';
test('specialists cover named sports and a separate non-sports division',()=>{
 assert.ok(SPORT_DOMAINS.includes('NFL')&&SPORT_DOMAINS.includes('FCS'));
 assert.ok(NON_SPORTS_MARKETS.includes('ECONOMICS')&&NON_SPORTS_MARKETS.includes('POLITICS'));
 assert.equal(routeSpecialistTask({division:'SPORTS',sport:'NFL'}).division,'SPORTS');
 assert.equal(routeSpecialistTask({division:'PREDICTION_MARKETS',category:'ECONOMICS'}).division,'PREDICTION_MARKETS');
 assert.equal(routeSpecialistTask({division:'SPORTS',sport:'ECONOMICS'}),null);
 assert.ok(SPECIALIST_AGENTS.some(x=>x.role==='SOFTWARE_ENGINEER'));
 assert.ok(SPECIALIST_AGENTS.some(x=>x.role==='PRODUCT_DESIGN'));
 assert.ok(SPECIALIST_AGENTS.some(x=>x.role==='DATA_QUALITY'));
 assert.ok(SPECIALIST_AGENTS.every(x=>x.execution==='DISABLED_UNTIL_CERTIFIED'));
 assert.equal(specialistNetworkManifest().dataPolicy,'APPEND_ONLY_NO_AUTOMATIC_LEGACY_DELETION');
});
