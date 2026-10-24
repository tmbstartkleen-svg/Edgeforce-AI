import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/app/api/ingest/odds/route.ts',import.meta.url),'utf8');
test('odds ingest does not import or persist demo markets',()=>{assert.doesNotMatch(source,/demoMarkets/);assert.doesNotMatch(source,/saveMarketSnapshots\([^\n]*'fallback'/);});
test('unconfigured provider fails closed with no snapshots',()=>{assert.match(source,/mode:'unconfigured'/);assert.match(source,/snapshots:0,persisted:0,markets:\[\]/);});
test('provider errors never save fallback prices under DraftKings',()=>{assert.match(source,/mode:'failed'/);assert.match(source,/status:503/);});
test('empty live response is not called successful ingestion',()=>{assert.match(source,/mode:'live_empty'/);});
