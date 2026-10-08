import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/lib/providers/kalshi.ts',import.meta.url),'utf8');

test('Kalshi rejects are categorized distinctly from success and rate limits',()=>{
 assert.match(source,/status===429\?'rate_limited'/);
 assert.match(source,/status===401\|\|status===403\?'unauthorized'/);
 assert.match(source,/status>=500\?'upstream_unavailable'/);
});

test('Kalshi honors capped Retry-After and avoids same-isolate rejected bursts',()=>{
 assert.match(source,/Math\.min\(300000,time-now\)/);
 assert.match(source,/Date\.now\(\)<cooldownUntil/);
 assert.match(source,/res\.headers\.get\('retry-after'\)/);
 assert.match(source,/retryAfterMs:contracts\.length\?undefined:retryAfterMs/);
});

test('Kalshi cooldown clears after successful upstream response',()=>{
 assert.match(source,/cooldownUntil=0;\s*lastFailureKind='';/);
});
