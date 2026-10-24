import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/lib/providers/oddsApi2.ts',import.meta.url),'utf8');
test('secondary sportsbook adapter never fabricates an observation timestamp',()=>{
 assert.doesNotMatch(source,/book\.last_update,\s*new Date\(\)\.toISOString\(\)/);
 assert.match(source,/book\.last_update,\s*''/);
});
test('invalid and missing provider timestamp is rejected before accepting odds',()=>{
 const guard=source.indexOf('if(!Number.isFinite(Date.parse(updatedAt)))');
 const push=source.indexOf('rows.push({',guard);
 assert.ok(guard>0&&push>guard);
});
