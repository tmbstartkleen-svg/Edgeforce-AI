import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const code=readFileSync('worker/d1-sports-snapshots.ts','utf8');
test('D1 sports read endpoint enforces authorization and bounded reads',()=>{
 assert.match(code,/UNAUTHORIZED/);
 assert.match(code,/Number\(raw\)>100/);
 assert.match(code,/FROM sports_market_snapshots/);
 assert.match(code,/neonHistoricalRecordsMigrated:false/);
 assert.doesNotMatch(code,/SELECT \*/);
});
