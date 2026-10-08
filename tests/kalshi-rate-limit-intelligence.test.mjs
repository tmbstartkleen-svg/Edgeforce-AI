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

test('Bad request and nonexistent routes back off instead of hammering Kalshi',()=>{
 assert.match(source,/res\.status===400\|\|res\.status===404/);
 assert.match(source,/res\.status===400\|\|res\.status===404\?60000/);
});

test('Network errors and timeouts carry a bounded cooldown classification',()=>{
 assert.match(source,/controller\.signal\.aborted\?'timeout':'network_error'/);
 assert.match(source,/cooldownUntil=Date\.now\(\)\+15000/);
});

test('Partially fetched pagination stays visible to consumers',()=>{
 assert.match(source,/partial:rows\.length>0&&Boolean\(error\)/);
 assert.match(source,/\n  errorKind,\n  retryAfterMs,/);
});
