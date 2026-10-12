import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {appendSportsMarketSnapshot,recentSportsMarketSnapshots} from '../src/lib/intelligence-core/d1-sports-market-store.mjs';
const now=Date.now();
const quote={sourceId:'feed',upstreamId:'upstream',sourceEventId:'game1',sport:'NFL',league:'NFL',home:'TeamA',away:'TeamB',startTime:new Date(now).toISOString(),market:'h2h',selection:'TeamA',bookmaker:'book',odds:-110,observedAt:now};
test('D1 quote writer requires approval and preserves exact upstream timestamp',async()=>{
 const calls=[];
 const db={prepare(sql){calls.push(sql);return {bind(...args){this.args=args;return this},async run(){return {meta:{changes:1}}}}}};
 await assert.rejects(appendSportsMarketSnapshot(db,quote),/SOURCE_APPROVAL_REQUIRED/);
 const x=await appendSportsMarketSnapshot(db,quote,{sourceApproved:true,now});
 assert.equal(x.written,1);assert.equal(x.legacyNeonModified,false);
 assert.match(x.payloadSha256,/^[a-f0-9]{64}$/);
 assert.ok(calls.some(sql=>sql.includes('INSERT OR IGNORE')));
});
test('rejects missing timestamp or impossible price',async()=>{
 const db={prepare(){throw Error('Should not reach D1')}};
 await assert.rejects(appendSportsMarketSnapshot(db,{...quote,observedAt:undefined},{sourceApproved:true,now}),/STALE_OR_INVALID_SOURCE_TIMESTAMP/);
 await assert.rejects(appendSportsMarketSnapshot(db,{...quote,odds:9999999},{sourceApproved:true,now}),/INVALID_AMERICAN_ODDS/);
});
test('D1 migration is additive and reads stay bounded',async()=>{
 const sql=fs.readFileSync('db/d1/0003_sports_market_snapshots.sql','utf8');
 assert.match(sql,/CREATE TABLE IF NOT EXISTS sports_market_snapshots/);
 assert.doesNotMatch(sql,/\bDROP\s+TABLE\b|\bTRUNCATE\b|\bDELETE\s+FROM\b/i);
 await assert.rejects(recentSportsMarketSnapshots({prepare(){}},{limit:10000}),/INVALID_READ_LIMIT/);
});
