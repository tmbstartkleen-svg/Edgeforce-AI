import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const source=fs.readFileSync(new URL('../src/lib/providers/theOddsApi.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const policy='data:text/javascript;base64,'+Buffer.from(
 'export function adaptiveOddsPolicy(){return {mode:"quota-safe",selectedSports:[],refreshMinutes:10,reasons:[]}}'
).toString('base64');
const moduleCode=compiled.replace("from './oddsRefreshPolicy'","from "+JSON.stringify(policy));
const moduleUrl='data:text/javascript;base64,'+Buffer.from(moduleCode).toString('base64');
const config={id:'the-odds-api',name:'The Odds API',capability:'ODDS',url:'the-odds-api://live-board',
 priority:1,timeoutMs:3000,enabled:true,bookmaker:'DraftKings',maxAgeMin:15,
 failureThreshold:3,quarantineMin:2,marketRole:'REFERENCE',consensusWeight:1};
const event=()=>({id:'event-1',sport_key:'basketball_nba',sport_title:'NBA',
 commence_time:new Date(Date.now()+3600000).toISOString(),home_team:'Home',away_team:'Away',
 bookmakers:[{key:'draftkings',title:'DraftKings',last_update:new Date().toISOString(),
  markets:[{key:'h2h',outcomes:[{name:'Home',price:-115},{name:'Away',price:105}]}]}]});
test('quota-safe refresh sends one DraftKings-only request and reports provider credit headers',async()=>{
 process.env.THE_ODDS_API_KEY='test-key-not-real';
 process.env.THE_ODDS_API_BASE_URL='https://odds-mock.invalid/v4';
 const original=globalThis.fetch;const calls=[];
 globalThis.fetch=async(input)=>{
  const url=new URL(String(input));calls.push(url);
  return Response.json([event()],{headers:{
   'x-requests-remaining':'249','x-requests-used':'251','x-requests-last':'1'
  }});
 };
 try{
  const {fetchTheOddsApiBoard}=await import(moduleUrl+'#single-call');
  const result=await fetchTheOddsApiBoard(config,{forceRefresh:true,quotaSafeSingleCall:true});
  assert.equal(calls.length,1);
  assert.equal(calls[0].pathname,'/v4/sports/upcoming/odds');
  assert.equal(calls[0].searchParams.get('bookmakers'),'draftkings');
  assert.equal(calls[0].searchParams.get('markets'),'h2h');
  assert.equal(calls[0].searchParams.get('regions'),null);
  assert.equal(calls[0].searchParams.get('bookmakers'),'draftkings');
  assert.equal(calls[0].searchParams.get('apiKey'),'test-key-not-real');
  assert.equal(result.ok,true);
  assert.equal(result.data.length,1);
  assert.equal(result.quota.remaining,249);
  assert.equal(result.quota.used,251);
  assert.equal(result.quota.last,1);
  assert.equal(result.attempts.length,1);
  assert.equal(result.attempts[0].remaining,249);
  assert.ok(result.warnings.some(x=>x.includes('one The Odds API bootstrap request only')));
 }finally{
  globalThis.fetch=original;
  delete process.env.THE_ODDS_API_KEY;
  delete process.env.THE_ODDS_API_BASE_URL;
 }
});
test('quota-safe failure does not retry, fall back or expand paid sport requests',async()=>{
 process.env.THE_ODDS_API_KEY='test-key-not-real';
 process.env.THE_ODDS_API_BASE_URL='https://odds-mock.invalid/v4';
 const original=globalThis.fetch;const calls=[];
 globalThis.fetch=async(input)=>{calls.push(new URL(String(input)));return new Response('quota exceeded',{status:429})};
 try{
  const {fetchTheOddsApiBoard}=await import(moduleUrl+'#quota-failure');
  const result=await fetchTheOddsApiBoard(config,{forceRefresh:true,quotaSafeSingleCall:true});
  assert.equal(calls.length,1);
  assert.equal(result.ok,false);
  assert.equal(result.attempts.length,1);
  assert.equal(result.attempts[0].status,429);
 }finally{
  globalThis.fetch=original;
  delete process.env.THE_ODDS_API_KEY;
  delete process.env.THE_ODDS_API_BASE_URL;
 }
});

test('normal Odds API bookmaker requests never combine regions and bookmakers selectors',()=>{
 const source=fs.readFileSync(new URL('../src/lib/providers/theOddsApi.ts',import.meta.url),'utf8');
 assert.match(source,/if\(bookmakers\)bootstrapParams\.bookmakers=bookmakers;\s*else bootstrapParams\.regions=regions/);
 assert.match(source,/if\(bookmakers\)expansionParams\.bookmakers=bookmakers;\s*else expansionParams\.regions=regions/);
 assert.match(source,/const fallbackUrl=withKey\('\/sports\/upcoming\/odds',key,\{\s*regions:'us',markets:'h2h'/);
});
