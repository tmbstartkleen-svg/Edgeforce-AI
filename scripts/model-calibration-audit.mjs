#!/usr/bin/env node
/**
 * Offline, read-only audit of an authorized export of already-settled outcomes.
 * Usage: npm run model:calibration-audit -- /path/to/settlements.json [--bins=10]
 * File content: array of SettledForecast records or {settlements:[...]}.
 * Does not certify provenance, holdout partition, or independent model status.
 */
import {readFile,stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import ts from 'typescript';

const args=process.argv.slice(2);
const fail=(reason,code=2)=>{
 console.error(reason);
 process.exitCode=code;
};
if(args.length<1||args.length>2||!args[0]||args[0].startsWith('-')||
 (args[1]&&!/^--bins=(?:[2-9]|1[0-9]|20)$/.test(args[1]))){
 fail('Usage: node scripts/model-calibration-audit.mjs <settlements.json> [--bins=2..20]');
}else{
 try{
  const path=resolve(args[0]);
  const metadata=await stat(path);
  if(!metadata.isFile()||metadata.size>8*1024*1024)
   throw Error('SETTLEMENT_EXPORT_MUST_BE_FILE_8MB_OR_LESS');
  const parsed=JSON.parse(await readFile(path,'utf8'));
  const items=Array.isArray(parsed)?parsed:parsed?.settlements;
  if(!Array.isArray(items)||items.length>50000)throw Error('INVALID_SETTLEMENT_EXPORT');
  const input=await readFile(new URL('../src/lib/heldout-calibration-audit.ts',import.meta.url),'utf8');
  const transpiled=ts.transpileModule(input,{compilerOptions:{
   module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022
  }}).outputText;
  const uri='data:text/javascript;base64,'+Buffer.from(transpiled).toString('base64');
  const {auditHeldOutProbabilityCalibration}=await import(uri);
  const bins=args[1]?Number(args[1].slice(7)):10;
  const report=auditHeldOutProbabilityCalibration(items,Date.now(),bins);
  console.log(JSON.stringify({ok:true,source:'LOCAL_SETTLEMENT_EXPORT',
   ...report,releaseCertified:false,modelAuthorizedForLivePicks:false},null,2));
  if(report.sampleSize===0)process.exitCode=3;
 }catch(error){
  fail(error instanceof SyntaxError?'INVALID_SETTLEMENT_JSON':
    error instanceof Error?error.message:'CALIBRATION_AUDIT_ERROR');
 }
}
