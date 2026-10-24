#!/usr/bin/env node
/**
 * Offline The Odds API sample auditor. Requires local repo dependencies.
 * Never calls a network endpoint, reads a secret, or writes to D1.
 * Usage: node scripts/odds-preflight.mjs <authorized-response.json> [--props]
 */
import {readFile,stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import ts from 'typescript';
const args=process.argv.slice(2);
if(args.length<1||args.length>2||!args[0]||args[0].startsWith('-')||(args.length===2&&args[1]!=='--props')){
 console.error('Usage: node scripts/odds-preflight.mjs <authorized-response.json> [--props]');
 process.exitCode=2;
}else{
 try{
  const path=resolve(args[0]),metadata=await stat(path);
  if(!metadata.isFile()||metadata.size>1024*1024)throw Error('JSON_FILE_MUST_BE_1_MB_OR_LESS');
  const payload=JSON.parse(await readFile(path,'utf8'));
  const transpile=async file=>ts.transpileModule(await readFile(new URL(file,import.meta.url),'utf8'),{
   compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
  const uri=code=>'data:text/javascript;base64,'+Buffer.from(code).toString('base64');
  const mapperUri=uri(await transpile('../src/lib/the-odds-api-d1-preparation.ts'));
  const preflight= (await transpile('../src/lib/odds-ingestion-preflight.ts'))
   .replace("from './the-odds-api-d1-preparation'","from "+JSON.stringify(mapperUri));
  const {assessOddsIngestionPreflight}=await import(uri(preflight));
  const result=assessOddsIngestionPreflight(payload,Date.now(),{playerPropDryRun:args.includes('--props')});
  console.log(JSON.stringify(result,null,2));
  if(result.targetQuoteCount===0)process.exitCode=3;
 }catch(error){
  console.error(error instanceof SyntaxError?'INVALID_PROVIDER_JSON':error instanceof Error?error.message:'INVALID_PREFLIGHT_INPUT');
  process.exitCode=2;
 }
}
