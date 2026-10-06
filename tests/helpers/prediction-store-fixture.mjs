import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const ts=createRequire(import.meta.url)('typescript');
let fixtureId=0;

export async function predictionStore(sql){
 const key=`edgeforce.prediction.store.test.${++fixtureId}`;
 globalThis[Symbol.for(key)]={sql};
 try{
  const source=readFileSync(new URL('../../src/lib/predictionContractPersistence.ts',import.meta.url),'utf8');
  const compiled=ts.transpileModule(source,{
   compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},reportDiagnostics:true,
  });
  assert.equal(compiled.diagnostics.length,0);
  const db=`const db=()=>globalThis[Symbol.for(${JSON.stringify(key)})].sql;`;
  const category="const classifyPredictionContract=contract=>contract.category;";
  const code=compiled.outputText
   .replace(/import\s*\{\s*db\s*\}\s*from\s*['"]\.\/db['"];?/,db)
   .replace(/import\s*\{\s*classifyPredictionContract\s*\}\s*from\s*['"]\.\/predictionCategories['"];?/,category);
  assert.ok(code.includes(db)&&code.includes(category),'the fixture must load the real writer');
  const runtime=await import(`data:text/javascript,${encodeURIComponent(code)}`);
  return {
   persist:runtime.persistPredictionContractBatch,
   dispose(){delete globalThis[Symbol.for(key)];},
  };
 }catch(error){delete globalThis[Symbol.for(key)];throw error;}
}

export const contract={
 id:'fixture-contract',title:'Fixture binary contract',category:'OTHER',source:'FixtureExchange',
 yesProbability:0.63,noProbability:0.39,modelProbability:0.63,probabilityDifference:0,
 volume:100,liquidity:200,
};

export function fakeDatabase({columns=[],rejectSnapshot=false,duplicate=false}={}){
 const queries=[];
 let commits=0,rollbacks=0,discoveries=0;
 const writes=[];
 const sql=async(strings,...values)=>{
  const text=strings.join('?');queries.push({text,values});
  assert.match(text,/information_schema\.columns/);
  discoveries++;
  return columns.map(column_name=>({column_name}));
 };
 sql.begin=async work=>{
  const pending=[];
  const tx=(strings,...values)=>{
   if(!Array.isArray(strings))return {insertRow:strings};
   const text=strings.join('?');queries.push({text,values});
   if(text.includes('prediction_market_state')){
    pending.push({state:values});return Promise.resolve([]);
   }
   assert.match(text,/insert into public\.prediction_market_snapshots/);
   if(rejectSnapshot)return Promise.reject(new Error('fixture snapshot failure'));
   const row=values.find(value=>value?.insertRow)?.insertRow;
   assert.ok(row,'parameterized snapshot row must be present');
   if(!duplicate)pending.push({snapshot:row});
   return Promise.resolve(duplicate?[]:[{id:1}]);
  };
  tx.json=value=>({json:value});
  try{const result=await work(tx);writes.push(...pending);commits++;return result;}
  catch(error){rollbacks++;throw error;}
 };
 return {sql,writes,queries,stats:()=>({commits,rollbacks,discoveries})};
}
