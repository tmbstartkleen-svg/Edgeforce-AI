import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/app/api/operations/persisted-odds-coverage/route.ts',import.meta.url),'utf8');
test('persisted odds audit is authenticated and read-only',()=>{assert.match(source,/process\.env\.CRON_SECRET/);assert.match(source,/UNAUTHORIZED/);assert.doesNotMatch(source,/ingestOdds\(|fetch\(/);assert.match(source,/externalApiRequestsMade:0/)});
test('audit distinguishes fresh DraftKings quotes from generic rows',()=>{assert.match(source,/draftkings_fresh_20m/);assert.match(source,/bookmakerProviderInventory/);assert.match(source,/sportInventory/)});
test('audit does not claim independent feeds or full market coverage',()=>{assert.match(source,/independentUpstreamsCertified:false/);assert.match(source,/completeMarketCoverageCertified:false/)});
