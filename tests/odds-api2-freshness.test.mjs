import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/lib/providers/oddsApi2.ts',import.meta.url),'utf8');
test('secondary odds provider rejects expired and future-dated prices',()=>{
 assert.match(source,/const quoteAgeMs=Date\.now\(\)-quoteTime/);
 assert.match(source,/quoteAgeMs< -30000\|\|quoteAgeMs>maxQuoteAgeMs/);
 assert.match(source,/continue;/);
});
test('freshness window honors configured provider maximum, with a minimum of one minute',()=>{
 assert.match(source,/Math\.max\(60000,Number\(process\.env\.ODDS_API_2_MAX_AGE_MIN\|\|'20'\)\*60000\)/);
});
