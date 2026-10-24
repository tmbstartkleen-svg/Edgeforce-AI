#!/usr/bin/env node
/** Offline full The Odds API DraftKings coverage audit, never calls provider.
 * Usage: npm run dk:full-export-audit -- /path/to/authorized-catalog-and-odds.json
 * Input shape: {events:[...The Odds API event responses],expected:[...]}
 * Does not certify authenticity, entitlement, full DK universe or live odds.
 */
import {readFile,stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import ts from 'typescript';
const args=process.argv.slice(2);
const uri=code=>'data:text/javascript;base64,'+Buffer.from(code).toString('base64');
if(args.length!==1||!args[0]||args[0].startsWith('-')){
 console.error('Usage: node scripts/full-draftkings-export-audit.mjs <catalog-and-odds.json>');
 process.exitCode=2;
}else{
 try{
  const filename=resolve(args[0]),meta=await stat(filename);
  if(!meta.isFile()||meta.size>16*1024*1024)throw Error('FULL_EXPORT_MUST_BE_FILE_16MB_OR_LESS');
  const data=JSON.parse(await readFile(filename,'utf8'));
  if(!data||!Array.isArray(data.events)||!Array.isArray(data.expected))
   throw Error('INVALID_FULL_DK_EXPORT');
  const transpile=async f=>ts.transpileModule(await readFile(new URL('../src/lib/'+f,import.meta.url),'utf8'),
   {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
  const dep=uri(await transpile('draftkings-market-gap-audit.ts'));
  const code=(await transpile('full-draftkings-export-audit.ts'))
    .replace("from './draftkings-market-gap-audit'","from "+JSON.stringify(dep));
  const {auditFullDraftKingsOddsExport}=await import(uri(code));
  const report=auditFullDraftKingsOddsExport(data.events,data.expected,Date.now());
  console.log(JSON.stringify({ok:true,...report},null,2));
  if(!report.coverageComplete)process.exitCode=3;
 }catch(e){
  console.error(e instanceof SyntaxError?'INVALID_FULL_EXPORT_JSON':
   e instanceof Error?e.message:'FULL_EXPORT_AUDIT_FAILED');
  process.exitCode=2;
 }
}
