import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const code=ts.transpileModule(fs.readFileSync(new URL('../src/lib/the-odds-api-d1-preparation.ts',import.meta.url),'utf8'),{reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {prepareTheOddsApiD1Batch}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const now=Date.parse('2026-10-23T12:00:00Z');
const event={id:'game-a',sport_key:'basketball_nba',sport_title:'NBA',commence_time:'2026-10-23T19:00:00Z',
 bookmakers:[{key:'draftkings',title:'DraftKings',last_update:'2026-10-23T11:59:30Z',
 markets:[{key:'h2h',outcomes:[{name:'Celtics',price:-120},{name:'Knicks',price:110}]},
 {key:'spreads',outcomes:[{name:'Celtics',price:-110,point:-2.5},{name:'Knicks',price:-110,point:2.5}]},
 {key:'player_points',outcomes:[{name:'Over',description:'Player',price:-110,point:20.5}]}]}]};
test('maps only core priced lines and keeps bookmaker timestamps, never writing',()=>{
 const r=prepareTheOddsApiD1Batch([event],now);
 assert.equal(r.mode,'DRY_RUN_ONLY');
 assert.equal(r.readyForAuthorizedIngest,false);
 assert.equal(r.prepared,4);
 assert.equal(r.playerPropsMapped,0);
 assert.equal(r.rows[0].provider,'the-odds-api');
 assert.equal(r.rows[0].upstreamId,'api.the-odds-api.com');
 assert.equal(r.rows[0].observedAt,Date.parse('2026-10-23T11:59:30Z'));
 assert.equal(r.rows[2].value.line,'-2.5');
 assert.equal(r.rejected.MARKET_NOT_MAPPED,1);
});
test('missing timestamps and stale/future prices cannot become fresh quotes',()=>{
 const missing={...event,bookmakers:[{...event.bookmakers[0],last_update:undefined}]};
 const stale={...event,bookmakers:[{...event.bookmakers[0],last_update:'2026-10-23T11:40:00Z'}]};
 const future={...event,bookmakers:[{...event.bookmakers[0],last_update:'2026-10-23T12:00:01Z'}]};
 for(const e of [missing,stale,future])assert.equal(prepareTheOddsApiD1Batch([e],now).prepared,0);
});
test('batch limit, malformed outcomes and started events fail closed',()=>{
 const r=prepareTheOddsApiD1Batch([event],now,2);
 assert.equal(r.prepared,2);
 assert.equal(r.rejected.BATCH_CAP_REACHED,2);
 const bad={...event,bookmakers:[{...event.bookmakers[0],markets:[{key:'h2h',outcomes:[{name:'Celtics',price:0}]}]}]};
 assert.equal(prepareTheOddsApiD1Batch([bad],now).prepared,0);
 assert.equal(prepareTheOddsApiD1Batch([{...event,commence_time:'2026-10-22T12:00:00Z'}],now).prepared,0);
 assert.throws(()=>prepareTheOddsApiD1Batch([],now,26),/INVALID_ODDS_PREPARATION_LIMIT/);
});

test('market timestamps override book time; stale markets cannot borrow freshness',()=>{
 const mixed={...event,bookmakers:[{...event.bookmakers[0],markets:[
  {key:'h2h',last_update:'2026-10-23T11:59:40Z',outcomes:[{name:'Celtics',price:-120}]},
  {key:'totals',last_update:'2026-10-23T11:40:00Z',outcomes:[{name:'Over',point:220.5,price:-110}]},
  {key:'spreads',last_update:'bad timestamp',outcomes:[{name:'Celtics',point:-2.5,price:-110}]}
 ]}]};
 const r=prepareTheOddsApiD1Batch([mixed],now);
 assert.equal(r.prepared,1);
 assert.equal(r.rows[0].observedAt,Date.parse('2026-10-23T11:59:40Z'));
 assert.equal(r.rejected.ODDS_QUOTE_TIMESTAMP_NOT_FRESH,1);
 assert.equal(r.rejected.INVALID_MARKET_TIMESTAMP,1);
});

test('dry run exposes unmapped player-prop markets without counting them as supported',()=>{
 const r=prepareTheOddsApiD1Batch([event],now);
 assert.deepEqual(r.observedBookmakers,['draftkings']);
 assert.deepEqual(r.unmappedMarketTypes,[{marketType:'player_points',count:1}]);
 assert.equal(r.playerPropsMapped,0);
});
test('pathologically wide provider arrays are bounded before nested traversal',()=>{
 const manyBooks={...event,bookmakers:Array.from({length:101},()=>event.bookmakers[0])};
 assert.equal(prepareTheOddsApiD1Batch([manyBooks],now).rejected.BOOKMAKER_BATCH_LIMIT,1);
 const wideMarkets={...event,bookmakers:[{...event.bookmakers[0],
  markets:Array.from({length:101},()=>event.bookmakers[0].markets[0])}]};
 assert.equal(prepareTheOddsApiD1Batch([wideMarkets],now).rejected.MARKET_BATCH_LIMIT,1);
 const wideOutcomes={...event,bookmakers:[{...event.bookmakers[0],
  markets:[{key:'h2h',outcomes:Array.from({length:101},()=>({name:'A',price:-110}))}]}]};
 assert.equal(prepareTheOddsApiD1Batch([wideOutcomes],now).rejected.OUTCOME_BATCH_LIMIT,1);
});

test('opt-in dry-run player prop mapping preserves player, side and line identity',()=>{
 const r=prepareTheOddsApiD1Batch([event],now,25,{enablePlayerProps:true});
 assert.equal(r.prepared,5);
 assert.equal(r.playerPropsMapped,1);
 const prop=r.rows.find(x=>x.value.marketType==='player_points');
 assert.equal(prop.value.playerId,'name:player');
 assert.equal(prop.value.playerName,'Player');
 assert.equal(prop.value.playerIdentityStatus,'UNVERIFIED_NAME_ONLY');
 assert.equal(prop.value.line,'20.5');
 assert.equal(prop.value.outcomeId,'Over');
 assert.equal(r.readyForAuthorizedIngest,false);
 assert.match(r.warning,/NOT stable verified player IDs/);
});
test('player props without named player or over-under outcome are rejected',()=>{
 const p={...event,bookmakers:[{...event.bookmakers[0],markets:[
 {key:'player_rebounds',outcomes:[{name:'Over',point:7.5,price:-115}]},
 {key:'player_assists',outcomes:[{name:'Yes',description:'Player',point:4.5,price:-120}]}
 ]}]};
 const r=prepareTheOddsApiD1Batch([p],now,25,{enablePlayerProps:true});
 assert.equal(r.prepared,0);
 assert.equal(r.playerPropsMapped,0);
 assert.equal(r.rejected.PLAYER_PROP_IDENTITY_REQUIRED,2);
});
test('unrecognized non-player markets never become valid props with opt-in',()=>{
 const p={...event,bookmakers:[{...event.bookmakers[0],markets:[
 {key:'alternate_unknown_market',outcomes:[{name:'Over',description:'Player',point:1.5,price:-110}]}
 ]}]};
 const r=prepareTheOddsApiD1Batch([p],now,25,{enablePlayerProps:true});
 assert.equal(r.prepared,0);
 assert.equal(r.rejected.MARKET_NOT_MAPPED,1);
});

test('provisional player IDs normalize repeated whitespace without claiming athlete verification',()=>{
 const changed={...event,bookmakers:[{...event.bookmakers[0],markets:[
  {key:'player_points',outcomes:[{name:'Over',description:'  Jane   Doe  ',point:20.5,price:-110}]}
 ]}]};
 const r=prepareTheOddsApiD1Batch([changed],now,25,{enablePlayerProps:true});
 assert.equal(r.prepared,1);
 assert.equal(r.rows[0].value.playerId,'name:jane doe');
 assert.equal(r.rows[0].value.playerIdentityStatus,'UNVERIFIED_NAME_ONLY');
 assert.equal(r.readyForAuthorizedIngest,false);
});

test('event rejection audit separates started fixtures from broken provider records',()=>{
 const alreadyStarted={...event,commence_time:'2026-10-23T11:00:00Z'};
 const missingIdentity={...event,id:''};
 const malformedTime={...event,commence_time:'bad'};
 const result=prepareTheOddsApiD1Batch([event,alreadyStarted,missingIdentity,malformedTime],now);
 assert.equal(result.eventAudit.examined,4);
 assert.equal(result.eventAudit.eligible,1);
 assert.equal(result.eventAudit.invalid,3);
 assert.deepEqual(result.eventAudit.reasons,{EVENT_ALREADY_STARTED:1,EVENT_IDENTITY_MISSING:1,EVENT_TIME_INVALID:1});
 assert.equal(result.rejected.INVALID_EVENT,3);
});
test('bounded 25-row preparation warns clearly when quote sample was truncated',()=>{
 const rowLimit=prepareTheOddsApiD1Batch([event],now,1);
 assert.equal(rowLimit.sampleTruncated,true);
 const complete=prepareTheOddsApiD1Batch([event],now);
 assert.equal(complete.sampleTruncated,false);
});
