import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const read=p=>ts.transpileModule(fs.readFileSync(new URL('../'+p,import.meta.url),'utf8'),{
 compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const asUrl=c=>'data:text/javascript;base64,'+Buffer.from(c).toString('base64');
const mapper=asUrl(read('src/lib/the-odds-api-d1-preparation.ts'));
const source=read('src/lib/odds-ingestion-preflight.ts').replace(
 "from './the-odds-api-d1-preparation'","from "+JSON.stringify(mapper));
const {assessOddsIngestionPreflight}=await import(asUrl(source));
const now=Date.parse('2026-10-23T12:00:00Z');
const event={id:'evt1',sport_key:'basketball_nba',sport_title:'NBA',commence_time:'2026-10-23T17:00:00Z',
 bookmakers:[{key:'draftkings',title:'DraftKings',last_update:'2026-10-23T11:59:30Z',
 markets:[{key:'h2h',outcomes:[{name:'Home',price:-110},{name:'Away',price:+100}]},
 {key:'player_points',outcomes:[{name:'Over',description:'Jane Doe',point:22.5,price:-115}]}]},
 {key:'fanduel',title:'FanDuel',last_update:'2026-10-23T11:59:20Z',
 markets:[{key:'h2h',outcomes:[{name:'Home',price:-108}]}]}]};
test('no-write preflight partitions DK odds, prop evidence, other books and unverified source',()=>{
 const r=assessOddsIngestionPreflight([event],now,{playerPropDryRun:true});
 assert.equal(r.certified,false);
 assert.equal(r.mode,'NO_WRITE_PREFLIGHT');
 assert.equal(r.targetQuoteCount,3);
 assert.equal(r.otherBookmakerCount,1);
 assert.equal(r.distinctTargetOutcomes,3);
 assert.equal(r.provisionalPlayerPropQuotes,1);
 assert.equal(r.sports,1);
 assert.equal(r.leagues[0].observedMarketTypes,2);
 assert.equal(r.gates.sourceEntitlement.passed,false);
 assert.equal(r.gates.stablePlayerIdentity.passed,false);
 assert.equal(r.gates.D1Persistence.passed,false);
 assert.equal(r.gates.validPreparedPriceRows.passed,true);
 assert.equal(r.gates.fullMarketCatalog.passed,false);
});
test('default core-only mapping reports the unmapped player prop instead of inventing coverage',()=>{
 const r=assessOddsIngestionPreflight([event],now);
 assert.equal(r.provisionalPlayerPropQuotes,0);
 assert.deepEqual(r.unmappedMarketTypes,[{marketType:'player_points',count:1}]);
 assert.equal(r.gates.stablePlayerIdentity.reason,'NO_PLAYER_PROPS');
});
test('stale provider observations result in zero usable DK quotes',()=>{
 const stale={...event,bookmakers:event.bookmakers.map(b=>({...b,last_update:'2026-10-23T11:00:00Z'}))};
 const r=assessOddsIngestionPreflight([stale],now,{playerPropDryRun:true});
 assert.equal(r.targetQuoteCount,0);
 assert.equal(r.gates.validPreparedPriceRows.passed,false);
 assert.equal(r.gates.authenticUpstreamEvidence.passed,false);
});
test('duplicate same-market responses are exposed rather than hidden',()=>{
 const doubled={...event,bookmakers:[event.bookmakers[0],event.bookmakers[0]]};
 const r=assessOddsIngestionPreflight([doubled],now,{playerPropDryRun:true});
 assert.equal(r.duplicateTargetIdentities,3);
 assert.equal(r.gates.unambiguousTargetQuoteIdentity.passed,false);
 assert.equal(r.certified,false);
});
test('empty bookmaker selection cannot create certification',()=>{
 const r=assessOddsIngestionPreflight([event],now,{targetBookmaker:'Caesars'});
 assert.equal(r.targetQuoteCount,0);
 assert.equal(r.gates.validPreparedPriceRows.passed,false);
 assert.throws(()=>assessOddsIngestionPreflight([],now,{targetBookmaker:'  '}),/INVALID_TARGET_BOOKMAKER/);
});
