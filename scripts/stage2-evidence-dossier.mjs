#!/usr/bin/env node
/**
 * Offline Stage 2 inspection of an explicitly supplied historical evidence
 * bundle. No network, API quota, secret access, D1 writes, or release approval.
 * Usage: npm run stage2:dossier -- /path/to/authorized-evidence.json
 */
import {readFile,stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import ts from 'typescript';
const path=process.argv[2];
const uri=code=>'data:text/javascript;base64,'+Buffer.from(code).toString('base64');
if(process.argv.length!==3||!path||path.startsWith('-')){
 console.error('Usage: node scripts/stage2-evidence-dossier.mjs <authorized-evidence.json>');
 process.exitCode=2;
}else{
 try{
  const filename=resolve(path),metadata=await stat(filename);
  if(!metadata.isFile()||metadata.size>12*1024*1024)throw Error('STAGE2_EXPORT_MUST_BE_FILE_12MB_OR_LESS');
  const bundle=JSON.parse(await readFile(filename,'utf8'));
  const compile=async name=>ts.transpileModule(await readFile(new URL('../src/lib/'+name,import.meta.url),'utf8'),
   {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
  const c=uri(await compile('heldout-calibration-audit.ts'));
  const l=uri(await compile('closing-line-value-audit.ts'));
  const a=uri(await compile('independent-quote-agreement.ts'));
  const p=uri(await compile('paired-brier-skill.ts'));
  const combined=(await compile('stage2-evidence-dossier.ts'))
   .replace("from './heldout-calibration-audit'","from "+JSON.stringify(c))
   .replace("from './closing-line-value-audit'","from "+JSON.stringify(l))
   .replace("from './independent-quote-agreement'","from "+JSON.stringify(a))
   .replace("from './paired-brier-skill'","from "+JSON.stringify(p));
  const {evaluateStage2ResearchDossier}=await import(uri(combined));
  const output=evaluateStage2ResearchDossier(bundle,Date.now());
  console.log(JSON.stringify({ok:true,...output},null,2));
  if(!output.stage2ResearchMetricsAvailable)process.exitCode=3;
 }catch(error){
  console.error(error instanceof SyntaxError?'INVALID_STAGE2_JSON':
   error instanceof Error?error.message:'STAGE2_DOSSIER_FAILED');
  process.exitCode=2;
 }
}
