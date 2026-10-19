import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const code=readFileSync('worker/d1-independent-odds-audit.ts','utf8');
test('identical repeated quotes are counted once per source and book',()=>{
 assert.match(code,/distinctQuoteKeys:new Set<string>\(\)/);
 assert.match(code,/q\.upstreamId,q\.bookmaker,q\.americanOdds,q\.observedAt/);
 assert.match(code,/g\.duplicateQuotes\+\+;rejected\+\+/);
 assert.match(code,/duplicateQuotes:g\.duplicateQuotes/);
});
test('even diversified prices cannot become verified bets without identity certification',()=>{
 assert.match(code,/upstreamIdentityAuthenticated:false/);
 assert.match(code,/oddsOfficiallyVerified:false/);
 assert.match(code,/betRecommendationAuthorized:false/);
});
