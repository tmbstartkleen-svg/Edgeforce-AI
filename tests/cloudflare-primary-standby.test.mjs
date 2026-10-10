import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';

const cloudflare=readFileSync(new URL('../.github/workflows/deploy-cloudflare.yml',import.meta.url),'utf8');
const vercel=readFileSync(new URL('../.github/workflows/deploy-production.yml',import.meta.url),'utf8');
const config=JSON.parse(readFileSync(new URL('../config/vercel-team-governor.json',import.meta.url),'utf8'));
const planner=readFileSync(new URL('../scripts/team-vercel-governor.mjs',import.meta.url),'utf8');
const doctor=readFileSync(new URL('../src/app/api/launch-doctor/route.ts',import.meta.url),'utf8');
const wrangler=JSON.parse(readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8'));
const vercelJson=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
const communityScores=readFileSync(new URL('../src/lib/providers/communityScoreBackups.ts',import.meta.url),'utf8');
const oddsApi=readFileSync(new URL('../src/lib/providers/theOddsApi.ts',import.meta.url),'utf8');
const kalshi=readFileSync(new URL('../src/lib/providers/kalshi.ts',import.meta.url),'utf8');
const predictionFlow=readFileSync(new URL('../src/lib/predictionFlow.ts',import.meta.url),'utf8');
const predictionTrader=readFileSync(new URL('../src/lib/predictionTraderIntelligence.ts',import.meta.url),'utf8');

test('V144 Cloudflare requires both exact-main certification workflows',()=>{
 assert.match(cloudflare,/Require both exact-main certification workflows/);
 assert.match(cloudflare,/Verify Edgeforce"/);
 assert.match(cloudflare,/Verify Edgeforce Cloudflare"/);
 assert.match(cloudflare,/head_sha=\$DEPLOY_COMMIT/);
});

test('V144 sportsbook quota cannot block Cloudflare platform deployment',()=>{
 assert.doesNotMatch(cloudflare,/missing\+=\("THE_ODDS_API_KEY"\)/);
 assert.match(cloudflare,/Certify recommendation data without blocking platform launch/);
 assert.match(cloudflare,/HTTP_CODE" != "200".*"422"/s);
 assert.match(cloudflare,/launch-doctor\?strict=1&platform=1/);
 assert.match(doctor,/platformOnly/);
 assert.match(doctor,/recommendationReady/);
 assert.match(doctor,/platformReady/);
});

test('V144 Vercel production is manual standby only',()=>{
 assert.match(vercel,/on:\n  workflow_dispatch:/);
 assert.doesNotMatch(vercel,/push:\n\s+branches: \[main\]/);
 const edge=config.projects.find(p=>p.key==='edgeforce');
 assert.equal(edge.autoRelease,false);
 assert.equal(edge.standbyRole,'manual-disaster-recovery');
 assert.match(planner,/project\.autoRelease!==false/);
 assert.match(planner,/Vercel is manual disaster-recovery standby/);
});

test('V144 free-first score mesh is enabled on Cloudflare',()=>{
 assert.equal(wrangler.vars.SPORTSCORE_ENABLED,'true');
 assert.equal(wrangler.vars.THESPORTSDB_ENABLED,'true');
 assert.match(wrangler.vars.API_SPORTS_SCORE_ENDPOINTS_JSON,/football\.api-sports\.io/);
 assert.equal(wrangler.vars.BIGBALLS_API_BASE_URL,undefined);
 assert.match(communityScores,/BIGBALLS_API_BASE_URL\|\|'https:\/\/api\.bigballsdata\.com\/v1'/);
});

test('Cloudflare omits default-valued provider URL bindings to preserve free-tier headroom',()=>{
 for(const key of ['THE_ODDS_API_BASE_URL','KALSHI_API_BASE_URL','POLYMARKET_DATA_URL','POLYMARKET_DATA_V2_URL','BIGBALLS_API_BASE_URL']){
  assert.equal(wrangler.vars[key],undefined,key+' should rely on its runtime default');
 }
 assert.match(oddsApi,/THE_ODDS_API_BASE_URL\|\|'https:\/\/api\.the-odds-api\.com\/v4'/);
 assert.match(kalshi,/KALSHI_API_BASE_URL\|\|'https:\/\/external-api\.kalshi\.com\/trade-api\/v2'/);
 assert.match(predictionFlow,/POLYMARKET_DATA_URL\|\|'https:\/\/data-api\.polymarket\.com'/);
 assert.match(predictionTrader,/POLYMARKET_DATA_V2_URL\|\|'https:\/\/data-api\.polymarket\.com\/v2'/);
 assert.match(communityScores,/BIGBALLS_API_BASE_URL\|\|'https:\/\/api\.bigballsdata\.com\/v1'/);
});

test('V144 optional provider secrets are wired but never required',()=>{
 for(const name of ['THE_ODDS_API_KEY','SPORTS_GAME_ODDS_API_KEY','FOOTBALL_DATA_API_KEY','API_SPORTS_KEY','BIGBALLS_API_KEY']){
  assert.match(cloudflare,new RegExp(name));
 }
 assert.match(cloudflare,/EDGEFORCE_DATABASE_URL or DATABASE_URL/);
});


test('Vercel standby config registers no cron jobs on Hobby',()=>{
 assert.equal(vercelJson.crons,undefined);
 assert.equal(vercelJson.git?.deploymentEnabled,false);
 assert.match(vercel,/jq 'del\(\.crons\)' vercel\.json/);
});
