import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const math=readFileSync('src/lib/edgeValue.ts','utf8');
const presentation=readFileSync('src/lib/boardValueMetrics.ts','utf8').replace("import {calculateEdgeValue} from './edgeValue';",'');
const js=ts.transpileModule(math+'\n'+presentation,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {boardValueMetrics}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
test('all-sports board calculates break-even and model-based expected ROI correctly',()=>{
 const m=boardValueMetrics(-117,.571);
 assert.ok(Math.abs(m.breakEvenProbability*100-53.91705)<0.0001);
 assert.ok(Math.abs(m.expectedRoiPercent-5.9034)<0.001);
 assert.equal(m.verified,false);
 assert.equal(boardValueMetrics(0,.5),null);
});
test('mobile and desktop boards expose transparent price metrics and disclaimer',()=>{
 const view=readFileSync('src/components/Dashboard.tsx','utf8');
 assert.match(view,/<th>Break-even %<\/th><th>EV ROI %<\/th>/);
 assert.match(view,/<small>BREAK-EVEN<\/small>/);
 assert.match(view,/<small>EV ROI<\/small>/);
 assert.match(view,/Unverified values are not betting recommendations/);
 assert.match(view,/boardValueMetrics\(x\.odds,x\.simProbability\)/);
});
