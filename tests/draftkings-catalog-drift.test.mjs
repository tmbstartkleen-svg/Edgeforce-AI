import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const raw=fs.readFileSync(new URL('../src/lib/draftkings-catalog-drift.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(raw,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {compareDraftKingsCatalogSnapshots}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
const now=Date.parse('2026-10-23T20:00:00Z');
const game=(extra={})=>({sport:'soccer',league:'Premier League',marketType:'h2h',kind:'game',...extra});
const prop=(extra={})=>({sport:'basketball_nba',league:'NBA',marketType:'player_points',
 kind:'player-prop',eventId:'game-1',playerId:'athlete-1',line:'20.5',...extra});
const before=records=>({asOf:'2026-10-23T16:00:00Z',sourceId:'DK-catalog-review',required:records});
const after=records=>({asOf:'2026-10-23T17:00:00Z',sourceId:'DK-catalog-review',required:records});
test('new soccer leagues and player lines become distinct follow-up gaps',()=>{
 const r=compareDraftKingsCatalogSnapshots(before([game(),prop()]),
 after([game(),prop({line:'21.5'}),game({league:'Championship'})]),now);
 assert.equal(r.addedCount,2);assert.equal(r.missingCount,1);
 assert.deepEqual(r.addedByType,{playerProps:1,gameMarkets:1});
 assert.deepEqual(r.missingByType,{playerProps:1,gameMarkets:0});
 assert.equal(r.requiresCatalogReview,true);assert.equal(r.releaseCertified,false);
});
test('order or capitalization changes do not create phantom coverage drift',()=>{
 const r=compareDraftKingsCatalogSnapshots(before([game(),prop()]),
 after([prop(),game({sport:'SOCCER',league:'premier league'})]),now);
 assert.equal(r.addedCount,0);assert.equal(r.missingCount,0);
 assert.equal(r.requiresCatalogReview,false);
});
test('duplicate and malformed expected requirements remain visible',()=>{
 const r=compareDraftKingsCatalogSnapshots(before([game(),game(),{...game(),kind:'bad'}]),
 after([game()]),now);
 assert.equal(r.duplicatePrevious,1);
 assert.equal(r.invalidPrevious,1);
 assert.equal(r.previousCount,1);
 assert.equal(r.requiresCatalogReview,true);
});
test('time order and invalid source cannot be passed off as drift',()=>{
 assert.throws(()=>compareDraftKingsCatalogSnapshots(after([]),before([]),now),/CATALOG_TIME_NOT_MONOTONIC/);
 assert.throws(()=>compareDraftKingsCatalogSnapshots(before([]),{...after([]),sourceId:''},now),/INVALID_CATALOG_SNAPSHOT/);
 assert.throws(()=>compareDraftKingsCatalogSnapshots(before([]),after([]),Infinity),/INVALID_CATALOG_TIME/);
});
test('catalog comparison does not fetch DK or claim executable source entitlement',()=>{
 assert.doesNotMatch(raw,/fetch\(|INSERT INTO|Math\.random|writeFile\(/);
});
