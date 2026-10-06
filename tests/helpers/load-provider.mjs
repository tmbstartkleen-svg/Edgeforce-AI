import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const require=createRequire(import.meta.url);
const ts=require('typescript');
const root=fileURLToPath(new URL('../../src/lib/providers/',import.meta.url));
export function loadProvider(name,overrides={}){
 const loaded=new Map();
 const load=file=>{
  if(loaded.has(file))return loaded.get(file).exports;
  const source=readFileSync(file,'utf8');
  const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
  assert.equal(output.diagnostics.length,0,'real provider source must transpile');
  const module={exports:{}};loaded.set(file,module);
  const localRequire=id=>{
   if(Object.hasOwn(overrides,id))return overrides[id];
   if(id.startsWith('node:'))return require(id);
   if(id.startsWith('.'))return load(path.resolve(path.dirname(file),id+'.ts'));
   return require(id);
  };
  new Function('require','module','exports',output.outputText)(localRequire,module,module.exports);
  return module.exports;
 };
 return load(path.join(root,name+'.ts'));
}
