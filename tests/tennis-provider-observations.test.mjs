import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const route=readFileSync('src/app/api/tennis-observations/route.ts','utf8');
test('tennis observations use the configured real source without enabling writes',()=>{
 assert.match(route,/fetchSportScoreBackup\(\)/);
 assert.match(route,/SPORTSCORE_DISABLED/);
 assert.match(route,/previewTennisD1Batches\(records/);
 assert.doesNotMatch(route,/d1ReferenceIngest|\.batch\(|INSERT INTO|UPDATE events/);
});
test('tennis feed reports missing timestamps and cannot certify odds or upstream freshness',()=>{
 assert.match(route,/excludedMissingStartTime/);
 assert.match(route,/providerTimestampVerified:false/);
 assert.match(route,/sourceApprovedForMarketRanking:false/);
 assert.match(route,/draftKingsInventoryCertified:false/);
});
