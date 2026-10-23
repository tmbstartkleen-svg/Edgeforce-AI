#!/usr/bin/env node
/**
 * Offline-only sportsbook odds readiness audit.
 * Accepts a locally supplied The Odds API v4 JSON array. Never fetches,
 * accesses credentials, registers providers, or writes a database.
 *
 * Usage:
 *   node --experimental-strip-types scripts/odds-preflight.mts /path/to/authorized-response.json [--props]
 *
 * Node runtime must support TypeScript stripping. This is a research utility,
 * not an authenticated feed connector or production ingest switch.
 */
import {readFile,stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {assessOddsIngestionPreflight} from '../src/lib/odds-ingestion-preflight.ts';
const usage='Usage: node --experimental-strip-types scripts/odds-preflight.mts <authorized-response.json> [--props]';
const argv=process.argv.slice(2);
if(argv.length<1||argv.length>2||argv.some(x=>x.startsWith('-')&&x!=='--props')||(argv.length===2&&argv[1]!=='--props')){
 console.error(usage);process.exitCode=2;
}else{
 const path=resolve(argv[0]);
 try{
  const metadata=await stat(path);
  if(!metadata.isFile()||metadata.size>1024*1024)throw new Error('JSON_FILE_MUST_BE_1_MB_OR_LESS');
  const payload=JSON.parse(await readFile(path,'utf8'));
  const report=assessOddsIngestionPreflight(payload,Date.now(),{playerPropDryRun:argv.includes('--props')});
  console.log(JSON.stringify(report,null,2));
  if(report.targetQuoteCount===0)process.exitCode=3;
 }catch(err){
  console.error(err instanceof SyntaxError?'INVALID_PROVIDER_JSON':err instanceof Error?err.message:'INVALID_PREFLIGHT_INPUT');
  process.exitCode=2;
 }
}
