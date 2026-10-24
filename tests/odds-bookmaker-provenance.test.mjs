import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/lib/providers/config.ts',import.meta.url),'utf8');
test('generic primary odds configuration does not impersonate DraftKings',()=>{
 assert.doesNotMatch(source,/ODDS_PROVIDER_PRIMARY'\?'DraftKings'/);
 assert.match(source,/bookmaker:process\.env\[\x60\$\{prefix\}_BOOKMAKER\x60\]\|\|name/);
});
test('The Odds API aggregator is not itself a bookmaker',()=>{
 const block=source.slice(source.indexOf('function theOddsApiProvider()'),source.indexOf('export function configuredProviders'));
 assert.match(block,/bookmaker:'The Odds API'/);
 assert.doesNotMatch(block,/bookmaker:'DraftKings'/);
});
