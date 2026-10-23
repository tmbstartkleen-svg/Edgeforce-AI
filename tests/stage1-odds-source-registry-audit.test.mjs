import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const raw=readFileSync(new URL('../src/lib/stage1-odds-source-registry-audit.ts',import.meta.url),'utf8');
const transpiled=ts.transpileModule(raw,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {inspectOddsSourceRegistry}=await import('data:text/javascript;base64,'+Buffer.from(transpiled).toString('base64'));
const source=(type,id,upstream,enabled=1)=>({source_id:id,source_type:type,upstream_id:upstream,enabled});
test('a pilot with sixteen enabled scoreboard sources and zero odds remains blocked',()=>{
 const sources=Array.from({length:16},(_,i)=>source('scoreboard','espn-scoreboard-'+i,'site.api.espn.com'));
 sources.push(source('CERTIFICATION_ONLY','cert','cert-upstream',0));
 const result=inspectOddsSourceRegistry({sources,storedOddsRows:0});
 assert.equal(result.totalRegistered,17);
 assert.equal(result.bySourceType.scoreboard.enabled,16);
 assert.equal(result.enabledSportsbookSources,0);
 assert.equal(result.distinctSportsbookUpstreams,0);
 assert.equal(result.verifiedValueBets,0);
 assert.ok(result.blockers.includes('NO_ENABLED_SPORTSBOOK_ODDS_SOURCE'));
 assert.ok(result.blockers.includes('NO_PERSISTED_SPORTSBOOK_ODDS'));
});
test('bookmaker names within the same aggregator do not count as independent upstreams',()=>{
 const r=inspectOddsSourceRegistry({sources:[
  source('sportsbook-odds','draftkings-via-aggregator','api.the-odds-api.com'),
  source('sportsbook-odds','fanduel-via-aggregator','api.the-odds-api.com')
 ],storedOddsRows:20,independentlyAuditedOperators:[
  {upstreamId:'api.the-odds-api.com',operatorId:'odds-aggregator',evidenceReference:'audit-1'}
 ]});
 assert.equal(r.enabledSportsbookSources,2);
 assert.equal(r.distinctSportsbookUpstreams,1);
 assert.equal(r.independentlyAttestedOperatorLabels,1);
 assert.equal(r.releaseCertified,false);
});
test('even two claimed operators do not automatically grant storage entitlement',()=>{
 const r=inspectOddsSourceRegistry({sources:[
  source('sportsbook-odds','feed-a','upstream-a'),
  source('sportsbook-odds','feed-b','upstream-b')
 ],storedOddsRows:15,independentlyAuditedOperators:[
  {upstreamId:'upstream-a',operatorId:'operator-a',evidenceReference:'a'},
  {upstreamId:'upstream-b',operatorId:'operator-b',evidenceReference:'b'}
 ]});
 assert.equal(r.independentlyAttestedOperatorLabels,2);
 assert.ok(r.blockers.includes('STORAGE_ENTITLEMENT_NOT_INDEPENDENTLY_VERIFIED'));
 assert.equal(r.canWriteOdds,false);
});
test('malformed rows fail visibly and extra-long inputs fail closed',()=>{
 const r=inspectOddsSourceRegistry({sources:[
  source('scoreboard','espn','site.api.espn.com'),{source_id:'bad',upstream_id:'x',source_type:'scoreboard',enabled:5}
 ],storedOddsRows:0});
 assert.equal(r.malformed,1);
 assert.ok(r.blockers.includes('MALFORMED_REGISTRY_ROWS'));
 assert.throws(()=>inspectOddsSourceRegistry({sources:[],storedOddsRows:-1}),/INVALID_ODDS_REGISTRY_EVIDENCE/);
 assert.throws(()=>inspectOddsSourceRegistry({sources:[],storedOddsRows:0,independentlyAuditedOperators:[
  {upstreamId:'same',operatorId:'a',evidenceReference:'one'},
  {upstreamId:'same',operatorId:'b',evidenceReference:'two'}
 ]}),/DUPLICATE_OPERATOR_ATTESTATION/);
 assert.doesNotMatch(raw,/fetch\(|INSERT INTO|writeFile\(/);
});
