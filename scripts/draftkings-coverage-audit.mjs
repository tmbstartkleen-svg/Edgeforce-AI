#!/usr/bin/env node
/** Offline DK catalog gap audit from authorized local exports. No provider request.
 * Usage: npm run dk:coverage-audit -- /path/to/coverage.json
 * Input: {expected:[{sport,league,marketType,kind,eventId?}],observed:[...]}
 */
import {readFile,stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import ts from 'typescript';
const args=process.argv.slice(2);
if(args.length!==1||!args[0]||args[0].startsWith('-')){
 console.error('Usage: node scripts/draftkings-coverage-audit.mjs <coverage.json>');
 process.exitCode=2;
}else{
 try{
  const name=resolve(args[0]),meta=await stat(name);
  if(!meta.isFile()||meta.size>12*1024*1024)throw Error('COVERAGE_EXPORT_MUST_BE_FILE_12MB_OR_LESS');
  const input=JSON.parse(await readFile(name,'utf8'));
  if(!input||!Array.isArray(input.expected)||!Array.isArray(input.observed))
   throw Error('INVALID_COVERAGE_EXPORT');
  const source=await readFile(new URL('../src/lib/draftkings-market-gap-audit.ts',import.meta.url),'utf8');
  const js=ts.transpileModule(source,{compilerOptions:{
   module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022
  }}).outputText;
  const {auditDraftKingsMarketCoverage}=await import(
   'data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
  const report=auditDraftKingsMarketCoverage(input.expected,input.observed,Date.now());
  console.log(JSON.stringify({ok:true,...report,marketCatalogExternallyVerified:false},null,2));
  if(!report.coverageComplete)process.exitCode=3;
 }catch(e){
  console.error(e instanceof SyntaxError?'INVALID_COVERAGE_JSON':
   e instanceof Error?e.message:'COVERAGE_AUDIT_FAILED');
  process.exitCode=2;
 }
}
