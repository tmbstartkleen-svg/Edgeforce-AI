import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/lib/providers/payloadQuality.ts',import.meta.url),'utf8');

test('provider freshness excludes impossible future timestamps',()=>{
 assert.match(source,/const futureSkewCount=timestamps\.filter\(t=>t>now\+120000\)\.length/);
 assert.match(source,/const validTimestamps=timestamps\.filter\(t=>t<=now\+120000\)/);
 assert.match(source,/validTimestamps\.length\?Math\.max\(\.\.\.validTimestamps\):undefined/);
});

test('freshness diagnostics expose skew and uncertain timestamps',()=>{
 assert.match(source,/Ignored \$\{futureSkewCount\} future-skewed payload timestamp/);
 assert.match(source,/Payload timestamp unavailable or invalid; freshness confidence reduced/);
});
