import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const source=readFileSync(new URL('../src/components/MarketResearchLab.tsx',import.meta.url),'utf8');
test('market research lab compiles as TSX without parser diagnostics',()=>{
 const out=ts.transpileModule(source,{fileName:'MarketResearchLab.tsx',reportDiagnostics:true,
  compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}});
 assert.deepEqual(out.diagnostics?.filter(x=>x.category===ts.DiagnosticCategory.Error).map(x=>ts.flattenDiagnosticMessageText(x.messageText,'\n')),[]);
});
test('research lab uses manual assumptions, not certified live odds',()=>{
 assert.match(source,/evaluateValueBet\(/);
 assert.match(source,/Calculate hypothetical edge/);
 assert.match(source,/not a verified sportsbook quote timestamp/);
 assert.match(source,/fractional Kelly stake/);
});
