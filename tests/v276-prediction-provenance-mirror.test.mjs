import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const normalizer=readFileSync(new URL('../src/lib/predictionMarkets.ts',import.meta.url),'utf8');
const cron=readFileSync(new URL('../src/app/api/cron/predictions/route.ts',import.meta.url),'utf8');
test('contract normalization retains source timestamps without inventing them',()=>{
 assert.match(normalizer,/sourceObservedAt:str\(row\.observedAt/);
 assert.match(normalizer,/sourceEventId:str\(row\.eventId/);
 assert.doesNotMatch(normalizer,/sourceObservedAt:new Date/);
});
test('mirroring requires contract, event, provider and upstream observation time',()=>{
 assert.match(cron,/!contract\.sourceObservedAt\|\|!contract\.sourceEventId\|\|!contract\.id\|\|!contract\.source/);
 assert.match(cron,/mirrorCollectorPayload\('prediction-market',rows,source\)/);
 assert.match(cron,/INTELLIGENCE_MULTISPORT_MIRROR/);
 assert.match(cron,/\.slice\(0,100\)/);
});
