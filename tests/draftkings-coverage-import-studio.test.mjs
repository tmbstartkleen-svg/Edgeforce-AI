import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const ui=fs.readFileSync(new URL('../src/components/DraftKingsCoverageImportStudio.tsx',import.meta.url),'utf8');
const dashboard=fs.readFileSync(new URL('../src/components/LeagueCoverageDashboard.tsx',import.meta.url),'utf8');
test('coverage studio is mounted within existing League Coverage workspace',()=>{
 assert.match(dashboard,/import DraftKingsCoverageImportStudio from '\.\/DraftKingsCoverageImportStudio'/);
 assert.match(dashboard,/<DraftKingsCoverageImportStudio\s*\/>/);
});
test('browser-local full export analysis includes odds, roster and expected catalog checks',()=>{
 for(const token of ['buildDraftKingsCoverageWorkQueue','auditOddsExportPlayerIdentities',
  'compareDraftKingsCatalogSnapshots','file.text()','checkBundle(json)','setReport({gap,players,drift})'])
  assert.ok(ui.includes(token),token);
 assert.match(ui,/input type="file"/);
 assert.match(ui,/file\.size>MB/);
 assert.match(ui,/events\.length>500/);
 assert.match(ui,/expected\.length>5000/);
 assert.match(ui,/report\.gap\.rows\.filter/);
});
test('studio does not transmit odds payload, issue network calls, persist or claim certified player IDs',()=>{
 assert.doesNotMatch(ui,/\bfetch\(|localStorage|sessionStorage|indexedDB|FormData\(|INSERT INTO/);
 assert.match(ui,/Zero certified IDs/);
 assert.match(ui,/This is not full DraftKings network coverage/);
 assert.match(ui,/No gaps relative to the supplied catalog/);
 assert.match(ui,/not establish that the catalog is complete/);
});
test('coverage studio transpiles to valid React JSX',()=>{
 const out=ts.transpileModule(ui,{fileName:'DraftKingsCoverageImportStudio.tsx',reportDiagnostics:true,
  compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}});
 const errors=(out.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error);
 assert.deepEqual(errors.map(e=>ts.flattenDiagnosticMessageText(e.messageText,' ')),[]);
 assert.match(out.outputText,/jsx-runtime/);
});
