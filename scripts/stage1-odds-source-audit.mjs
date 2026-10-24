#!/usr/bin/env node
/**
 * Stage 1 read-only registry / odds count reconciliation.
 * Usage: npm run stage1:source-audit -- local-d1-summary.json
 * Format: {"sources":[{"source_id":"...","upstream_id":"...",
 *   "source_type":"scoreboard","enabled":1}],"storedOddsRows":0}
 * This never queries a database, runs a network call or grants permissions.
 */
import {readFile,stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import ts from 'typescript';
if(process.argv.length!==3||!process.argv[2]||process.argv[2].startsWith('-')){
 console.error('Usage: node scripts/stage1-odds-source-audit.mjs <local-registry-summary.json>');
 process.exitCode=2;
}else{
 try{
  const file=resolve(process.argv[2]);
  const fileInfo=await stat(file);
  if(!fileInfo.isFile()||fileInfo.size>1024*1024)
   throw Error('SOURCE_REGISTRY_FILE_MUST_BE_1MB_OR_LESS');
  const input=JSON.parse(await readFile(file,'utf8'));
  const source=await readFile(new URL('../src/lib/stage1-odds-source-registry-audit.ts',import.meta.url),'utf8');
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,
   target:ts.ScriptTarget.ES2022}}).outputText;
  const moduleUrl='data:text/javascript;base64,'+Buffer.from(code).toString('base64');
  const {inspectOddsSourceRegistry}=await import(moduleUrl);
  const report=inspectOddsSourceRegistry(input);
  console.log(JSON.stringify({ok:true,...report},null,2));
  if(report.blockers.length)process.exitCode=3;
 }catch(e){
  console.error(e instanceof SyntaxError?'INVALID_REGISTRY_JSON':
   e instanceof Error?e.message:'SOURCE_REGISTRY_AUDIT_FAILED');
  process.exitCode=2;
 }
}
