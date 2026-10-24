import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const compile=p=>ts.transpileModule(fs.readFileSync(new URL('../src/lib/'+p,import.meta.url),'utf8'),
 {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const uri=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const engine=uri(compile('verified-value-engine.ts'));
const boardSource=compile('verified-value-board.ts').replace("from './verified-value-engine'","from "+JSON.stringify(engine));
const {buildVerifiedValueBoard}=await import(uri(boardSource));
const now=Date.parse('2026-10-23T19:30:00Z');
const make=(id,p,odds=-117)=>({id,sport:'basketball',league:'NBA',eventName:'Test home vs away',
 signal:{quote:{bookmaker:'DraftKings',sourceUpstreamId:'api.the-odds-api.com',eventId:id,
  marketType:'h2h',outcomeId:'Home',americanOdds:odds,observedAt:new Date(now-30000).toISOString(),
  startsAt:new Date(now+3600000).toISOString()},
 forecast:{probability:p,modelId:'holdout-v1',modelVersion:'1',calibrated:true,
  independentlyDerived:true,sampleSize:800,calibrationMeanAbsoluteError:0.04,
  asOf:new Date(now-60000).toISOString()},
 verification:{independentUpstreams:2,priceAgreement:true,sourceEntitlementVerified:true}}});
test('ranks qualified positive EV offers by independent win probability then expected ROI',()=>{
 const board=buildVerifiedValueBoard([make('a',0.61),make('b',0.72),make('c',0.55)],now);
 assert.equal(board.eligibleCount,3);
 assert.deepEqual(board.rows.map(x=>x.id),['b','a','c']);
 assert.ok(board.rows[0].expectedRoiPercent>0);
 assert.equal(board.rows[0].releaseCertified,undefined);
 assert.equal(board.releaseCertified,false);
});
test('unverified prices, models and name-only player identities stay off value board',()=>{
 const a=make('a',0.70);a.signal.verification.independentUpstreams=1;
 const b=make('b',0.70);b.signal.forecast.calibrated=false;
 const c=make('c',0.70);c.signal.quote.marketType='player_points';
 c.signal.quote.playerId='name:unknown athlete';c.signal.quote.line='20.5';
 const r=buildVerifiedValueBoard([a,b,c],now);
 assert.equal(r.eligibleCount,0);
 assert.equal(r.rows.length,0);
 assert.equal(r.blockedReasons.INDEPENDENT_PRICE_CONFIRMATION_MISSING,1);
 assert.equal(r.blockedReasons.MODEL_CALIBRATION_NOT_CERTIFIED,1);
 assert.equal(r.blockedReasons.UNVERIFIED_PLAYER_ID,1);
});
test('distinct price sources do not collapse; exact duplicate markets do',()=>{
 const a=make('a',0.65);
 const dupe=make('a',0.65);
 const other=make('a',0.65);other.id='other-id';other.signal.quote.sourceUpstreamId='another-owner';
 const r=buildVerifiedValueBoard([a,dupe,other],now);
 assert.equal(r.duplicateMarkets,1);
 assert.equal(r.uniqueMarkets,2);
 assert.equal(r.eligibleCount,2);
});
test('valid no-edge forecasts remain outside pick list',()=>{
 const r=buildVerifiedValueBoard([make('a',0.40)],now);
 assert.equal(r.nonPositiveEdge,1);
 assert.equal(r.eligibleCount,0);
});
test('bounded board truncation and no fabricated odds/forecasts',()=>{
 const r=buildVerifiedValueBoard([make('a',0.7),make('b',0.6)],now,1);
 assert.equal(r.rows.length,1);assert.equal(r.truncated,true);
 assert.throws(()=>buildVerifiedValueBoard([],now,501),/INVALID_VALUE_BOARD_INPUT/);
 assert.doesNotMatch(boardSource,/fetch\(|Math\.random|INSERT INTO|writeFile/);
});
