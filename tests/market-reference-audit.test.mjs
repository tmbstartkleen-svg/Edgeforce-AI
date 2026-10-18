import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const options={compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}};
const edge=ts.transpileModule(fs.readFileSync(new URL('../src/lib/edgeValue.ts',import.meta.url),'utf8'),options).outputText;
const edgeUrl='data:text/javascript;base64,'+Buffer.from(edge).toString('base64');
const text=ts.transpileModule(fs.readFileSync(new URL('../src/lib/marketReferenceAudit.ts',import.meta.url),'utf8'),options).outputText.replace(/from ['"]\.\/edgeValue['"]/g,'from '+JSON.stringify(edgeUrl));
const {auditMarketReferences}=await import('data:text/javascript;base64,'+Buffer.from(text).toString('base64'));
const now='2026-10-18T00:00:00Z';
const quote=(book,upstream,odds=-117)=>({eventKey:'event-1',marketKey:'total-44.5',outcomeKey:'over',americanOdds:odds,sportsbook:book,upstreamId:upstream,observedAt:'2026-10-17T23:59:00Z'});
test('aggregator listing many sportsbooks counts as one upstream',()=>{
 const x=auditMarketReferences(quote('DraftKings','aggregate-1'),[quote('FanDuel','aggregate-1'),quote('Pinnacle','aggregate-1')],.571,now);
 assert.equal(x.status,'INSUFFICIENT_REFERENCE');assert.equal(x.independentUpstreams,1);
});
test('genuine second source is distinguishable',()=>{
 const x=auditMarketReferences(quote('DraftKings','source-1'),[quote('Pinnacle','source-2',-110)],.571,now);
 assert.equal(x.status,'INDEPENDENT_REFERENCE');
 assert.ok(x.modelEdgePp>3&&x.modelExpectedRoiPercent>5);
});
test('different line and stale reference are excluded',()=>{
 const changed={...quote('Pinnacle','source-2'),marketKey:'total-45.5'};
 const stale={...quote('FanDuel','source-3'),observedAt:'2026-10-16T00:00:00Z'};
 const x=auditMarketReferences(quote('DraftKings','source-1'),[changed,stale],.571,now);
 assert.equal(x.status,'INSUFFICIENT_REFERENCE');
});
