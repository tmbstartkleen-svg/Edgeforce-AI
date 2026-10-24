import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/app/api/operations/odds-provenance-audit/route.ts',import.meta.url),'utf8');
test('provenance audit requires bearer authentication',()=>{assert.match(source,/process\.env\.CRON_SECRET/);assert.match(source,/UNAUTHORIZED/)});
test('audit distinguishes provider source fields from bookmaker labels',()=>{assert.match(source,/sourceEventId/);assert.match(source,/sourceProviderId/);assert.match(source,/sourceAuthenticityVerified:false/)});
test('audit performs no live polling or writes',()=>{assert.match(source,/liveRequestsMade:0/);assert.match(source,/writesPerformed:0/);assert.doesNotMatch(source,/ingestOdds\(|fetch\(/)});
