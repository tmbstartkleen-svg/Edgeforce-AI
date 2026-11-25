import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {runPriceReviewPilot, syntheticPriceReviewPilot} from '../scripts/price-review-pilot.mjs';

const primary = 'odds-provider-primary';
const secondary = 'odds-provider-secondary';
const fixture = ()=>JSON.parse(JSON.stringify(syntheticPriceReviewPilot()));
const phase = (result, scenario)=>result.checks.find(check=>check.scenario===scenario);
const script = fileURLToPath(new URL('../scripts/price-review-pilot.mjs',import.meta.url));
const runCli = (...args)=>spawnSync(process.execPath,['--experimental-strip-types',script,...args],{encoding:'utf8',timeout:5_000});

test('the deterministic offline replay verifies match, withdrawal, reopening, outage and expiry',()=>{
 const result=runPriceReviewPilot(fixture());
 assert.equal(result.passed,true);
 assert.deepEqual(result.checks, ['MATCH','WITHDRAWAL','REOPEN','OUTAGE','EXPIRY'].map(scenario=>({scenario,passed:true})));
 assert.deepEqual(result.frames.map(frame=>frame.corroboratedMarkets),[1,0,1,0,0]);
 assert.deepEqual(result.frames.map(frame=>frame.respondedFeeds),[2,2,2,1,2]);
 assert.equal(result.frames[3].eligibleBookMarkets,1);
 assert.equal(result.frames[4].rejections.BOOK_UPDATE_EXPIRED,2);
 assert.deepEqual({evidence:result.evidence,productionVerified:result.productionVerified,
  recommendationsAuthorized:result.recommendationsAuthorized,externalRequests:result.externalRequests},
 {evidence:'SYNTHETIC_REPLAY',productionVerified:false,recommendationsAuthorized:false,externalRequests:0});
 assert.doesNotMatch(JSON.stringify(result),/sourceEventId|example-a\.example|americanOdds|expectedValue|stake/i);
});

test('a replay cannot substitute absence or an older status for a newer withdrawal',()=>{
 const missing=fixture();
 missing.frames[1].feeds[primary]=[];
 assert.equal(phase(runPriceReviewPilot(missing),'WITHDRAWAL').passed,false);
 const older=fixture();
 for (const row of older.frames[1].feeds[primary]) row.sourceTimestamp='2026-11-25T11:58:00Z';
 assert.equal(phase(runPriceReviewPilot(older),'WITHDRAWAL').passed,false);
});

test('a replay requires a genuinely newer reopen and rejects a second response masquerading as an outage',()=>{
 const stale=fixture();
 for (const row of stale.frames[2].feeds[primary]) row.sourceTimestamp=stale.frames[1].feeds[primary][0].sourceTimestamp;
 assert.equal(phase(runPriceReviewPilot(stale),'REOPEN').passed,false);
 const empty=fixture();
 empty.frames[3].feeds[secondary]=[];
 assert.equal(phase(runPriceReviewPilot(empty),'OUTAGE').passed,false);
});

test('expired evidence must be the unchanged connected-source revisions exercised at reopening',()=>{
 const rewritten=fixture();
 rewritten.frames[4].feeds[primary][0].odds=120;
 assert.equal(phase(runPriceReviewPilot(rewritten),'EXPIRY').passed,false);
 const afterStart=fixture();
 afterStart.frames[4].at='2026-11-25T14:00:01Z';
 assert.equal(phase(runPriceReviewPilot(afterStart),'EXPIRY').passed,false);
 const tooEarly=fixture();
 tooEarly.frames[4].at='2026-11-25T12:02:00Z';
 assert.equal(phase(runPriceReviewPilot(tooEarly),'EXPIRY').passed,false);
});

test('the input is limited to one selected league and one matching contract',()=>{
 const foreign=fixture();
 foreign.frames[1].feeds[primary][0].league='Different League';
 assert.throws(()=>runPriceReviewPilot(foreign),/selected sport and league/);
 const changed=fixture();
 changed.frames[1].feeds[primary][0].settlementKey='regulation-only';
 assert.throws(()=>runPriceReviewPilot(changed),/same fixture and market contract/);
 const missing=fixture();
 missing.frames.pop();
 assert.throws(()=>runPriceReviewPilot(missing),/five frames/);
 const invalidTime=fixture();
 invalidTime.frames[4].at='2026-02-30T12:00:00Z';
 assert.throws(()=>runPriceReviewPilot(invalidTime),/valid zoned timestamps/);
});

test('declared origin and operator must be distinct and the feed permissions structurally valid',()=>{
 for (const field of ['origin','operator','books']) {
  const duplicate=fixture();
  duplicate.feeds[1][field]=duplicate.feeds[0][field];
  assert.throws(()=>runPriceReviewPilot(duplicate),/must be distinct/);
 }
 const malformed=fixture();
 malformed.feeds[0].origin='http://example-a.example';
 assert.throws(()=>runPriceReviewPilot(malformed),/valid slot, HTTPS origin/);
});

test('the CLI distinguishes a local supplied replay from the synthetic default and exits nonzero for incomplete evidence',t=>{
 const example=runCli('--example');
 assert.equal(example.status,0,example.stderr);
 assert.equal(JSON.parse(example.stdout).schema,'edgeforce-price-review-pilot-v1');
 const synthetic=runCli();
 assert.equal(synthetic.status,0,synthetic.stderr);
 assert.equal(JSON.parse(synthetic.stdout).evidence,'SYNTHETIC_REPLAY');
 const dir=mkdtempSync(join(tmpdir(),'edgeforce-pilot-test-'));
 t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const path=join(dir,'replay.json');
 writeFileSync(path,example.stdout);
 const supplied=runCli('--file',path);
 assert.equal(supplied.status,0,supplied.stderr);
 const success=JSON.parse(supplied.stdout);
 assert.equal(success.evidence,'OPERATOR_SUPPLIED_REPLAY');
 assert.equal(success.productionVerified,false);
 const incomplete=fixture();
 incomplete.frames[3].feeds[secondary]=[];
 writeFileSync(path,JSON.stringify(incomplete));
 const failure=runCli('--file',path);
 assert.equal(failure.status,1,failure.stderr);
 assert.equal(phase(JSON.parse(failure.stdout),'OUTAGE').passed,false);
 writeFileSync(path,'malformed-data-that-must-not-be-logged');
 const unreadable=runCli('--file',path);
 assert.equal(unreadable.status,1,unreadable.stderr);
 assert.match(unreadable.stderr,/Could not read a valid local replay JSON file/);
 assert.doesNotMatch(unreadable.stderr,/malformed-data-that-must-not-be-logged|replay\.json/);
});
