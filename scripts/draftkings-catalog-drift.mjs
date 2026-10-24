#!/usr/bin/env node
/**
 * Compare two authorized DraftKings market-catalog exports, oldest first.
 * npm run dk:catalog-drift -- old-catalog.json new-catalog.json
 * No provider calls, access tokens, database changes or release approval.
 */
import {readFile,stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import ts from 'typescript';
if(process.argv.length!==4||process.argv.slice(2).some(x=>!x||x.startsWith('-'))){
 console.error('Usage: node scripts/draftkings-catalog-drift.mjs <old.json> <new.json>');
 process.exitCode=2;
}else{
 try{
  const load=async f=>{
   const file=resolve(f),info=await stat(file);
   if(!info.isFile()||info.size>8*1024*1024)throw Error('CATALOG_EXPORT_MUST_BE_FILE_8MB_OR_LESS');
   return JSON.parse(await readFile(file,'utf8'));
  };
  const before=await load(process.argv[2]),after=await load(process.argv[3]);
  const source=await readFile(new URL('../src/lib/draftkings-catalog-drift.ts',import.meta.url),'utf8');
  const transpiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
  const {compareDraftKingsCatalogSnapshots}=await import('data:text/javascript;base64,'+Buffer.from(transpiled).toString('base64'));
  const result=compareDraftKingsCatalogSnapshots(before,after,Date.now());
  console.log(JSON.stringify({ok:true,...result},null,2));
  if(result.requiresCatalogReview)process.exitCode=3;
 }catch(e){
  console.error(e instanceof SyntaxError?'INVALID_CATALOG_JSON':e instanceof Error?e.message:'CATALOG_DRIFT_FAILED');
  process.exitCode=2;
 }
}
