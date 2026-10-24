#!/usr/bin/env node
/**
 * Audit an authorized The Odds API event export against a local athlete roster.
 * Does NOT connect to an upstream, read secrets, store data or certify player
 * identity or executable prices.
 * npm run dk:player-identity-audit -- /path/to/authorized-export.json
 * Input: {events:[...],roster:[{athleteId,displayName,teamId,eventId,sport,league,aliases?}]}
 */
import {readFile,stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import ts from 'typescript';
if(process.argv.length!==3||!process.argv[2]||process.argv[2].startsWith('-')){
 console.error('Usage: node scripts/draftkings-player-identity-audit.mjs <authorized-export.json>');
 process.exitCode=2;
}else{
 try{
  const path=resolve(process.argv[2]),metadata=await stat(path);
  if(!metadata.isFile()||metadata.size>12*1024*1024)throw Error('PLAYER_EXPORT_MUST_BE_FILE_12MB_OR_LESS');
  const data=JSON.parse(await readFile(path,'utf8'));
  if(!data||!Array.isArray(data.events)||!Array.isArray(data.roster))
   throw Error('INVALID_PLAYER_IDENTITY_EXPORT');
  const transpile=async name=>ts.transpileModule(
   await readFile(new URL('../src/lib/'+name,import.meta.url),'utf8'),
   {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}
  ).outputText;
  const asUri=code=>'data:text/javascript;base64,'+Buffer.from(code).toString('base64');
  const helper=asUri(await transpile('draftkings-player-identity-reconciliation.ts'));
  const code=(await transpile('odds-export-player-identity-audit.ts'))
   .replace("from './draftkings-player-identity-reconciliation'","from "+JSON.stringify(helper));
  const {auditOddsExportPlayerIdentities}=await import(asUri(code));
  const report=auditOddsExportPlayerIdentities(data.events,data.roster,Date.now());
  console.log(JSON.stringify({ok:true,...report},null,2));
  // Matches are NOT authenticated; success exit means inspection ran only.
  if(report.unresolvedCount||Object.keys(report.providerRejections).length||Object.keys(report.issues).length)
   process.exitCode=3;
 }catch(error){
  console.error(error instanceof SyntaxError?'INVALID_PLAYER_IDENTITY_JSON':
   error instanceof Error?error.message:'PLAYER_IDENTITY_AUDIT_FAILED');
  process.exitCode=2;
 }
}
