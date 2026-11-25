import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source=readFileSync(new URL('../../src/lib/providers/oddsApi2.ts',import.meta.url),'utf8');
// Expose the real private normalizer only inside this isolated test module.
const compiled=ts.transpileModule(source+'\nexport {flattenSportPayload};\n',{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},reportDiagnostics:true
});
assert.equal(compiled.diagnostics.length,0,'Odds API 2 source must transpile');

export const fixtureNow=Date.parse('2026-11-25T12:00:00.000Z');

export function loadOddsApi2Normalizer({now=fixtureNow,env={}}={}){
 let networkRequests=0;
 const exports={};
 class FixedDate extends Date{
  constructor(...args){super(...(args.length?args:[now]));}
  static now(){return now;}
 }
 const context={exports,module:{exports},Date:FixedDate,process:{env:{...env}},
  fetch:()=>{networkRequests++;throw new Error('Network requests are prohibited in provider normalization tests');}
 };
 vm.runInNewContext(compiled.outputText,context,{filename:'oddsApi2.test-runtime.cjs',timeout:1000});
 return {
  normalize:(payload,sportKey='basketball_nba')=>exports.flattenSportPayload(payload,sportKey),
  provider:()=>exports.oddsApi2Provider({ODDS_API_2_KEY:'test-only-no-network-key',...env}),
  get networkRequests(){return networkRequests;}
 };
}

export function oddsApi2Payload(bookOverrides={}){
 return {success:true,data:[{
  event_id:'fixture-game',sport:'NBA',league:'NBA',home_team:'Home Team',away_team:'Away Team',
  start_time:new Date(fixtureNow+3600000).toISOString(),
  books:[{book:'draftkings',market:'h2h',outcomes:[{name:'Home Team',price:120}],...bookOverrides}]
 }]};
}
