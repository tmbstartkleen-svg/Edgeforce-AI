#!/usr/bin/env node
/**
 * Offline release-evidence inspection. Never performs D1 writes, provider
 * requests, deploys, or production authorizations.
 * npm run release:evidence-gate -- authorized-combined-evidence.json
 */
import {readFile,stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import ts from 'typescript';
const uri=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
if(process.argv.length!==3||!process.argv[2]||process.argv[2].startsWith('-')){
 console.error('Usage: node scripts/major-release-evidence-gate.mjs <authorized-evidence.json>');
 process.exitCode=2;
}else{
 try{
  const filename=resolve(process.argv[2]),meta=await stat(filename);
  if(!meta.isFile()||meta.size>20*1024*1024)throw Error('RELEASE_EVIDENCE_MUST_BE_FILE_20MB_OR_LESS');
  const input=JSON.parse(await readFile(filename,'utf8'));
  const transpile=async p=>ts.transpileModule(await readFile(new URL('../src/lib/'+p,import.meta.url),'utf8'),{
   compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
  const calibration=uri(await transpile('heldout-calibration-audit.ts'));
  const clv=uri(await transpile('closing-line-value-audit.ts'));
  const agreement=uri(await transpile('independent-quote-agreement.ts'));
  const paired=uri(await transpile('paired-brier-skill.ts'));
  const stage2=uri((await transpile('stage2-evidence-dossier.ts'))
   .replace("from './heldout-calibration-audit'","from "+JSON.stringify(calibration))
   .replace("from './closing-line-value-audit'","from "+JSON.stringify(clv))
   .replace("from './independent-quote-agreement'","from "+JSON.stringify(agreement))
   .replace("from './paired-brier-skill'","from "+JSON.stringify(paired)));
  const coverage=uri(await transpile('draftkings-market-gap-audit.ts'));
  const full=uri((await transpile('full-draftkings-export-audit.ts'))
   .replace("from './draftkings-market-gap-audit'","from "+JSON.stringify(coverage)));
  const gate=uri((await transpile('major-release-evidence-gate.ts'))
   .replace("from './stage2-evidence-dossier'","from "+JSON.stringify(stage2))
   .replace("from './full-draftkings-export-audit'","from "+JSON.stringify(full)));
  const {evaluateMajorReleaseEvidence}=await import(gate);
  const report=evaluateMajorReleaseEvidence(input,Date.now());
  console.log(JSON.stringify({ok:true,...report},null,2));
  // No dataset can issue an external production certification.
  process.exitCode=3;
 }catch(e){
  console.error(e instanceof SyntaxError?'INVALID_RELEASE_EVIDENCE_JSON':
   e instanceof Error?e.message:'RELEASE_EVIDENCE_AUDIT_FAILED');
  process.exitCode=2;
 }
}
