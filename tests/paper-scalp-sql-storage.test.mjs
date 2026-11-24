import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const data=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const read=p=>readFileSync(new URL('../src/lib/'+p+'.ts',import.meta.url),'utf8');
const paper=data(compile(read('paperScalpOrderEngine')));
const ledger=data(compile(read('paperScalpLedger')).replace(/from ['"]\.\/paperScalpOrderEngine['"]/g,"from '"+paper+"'"));
const sql=data(compile(read('paperScalpSqlStorage')).replace(/from ['"]\.\/paperScalpLedger['"]/g,"from '"+ledger+"'"));
const {createPaperScalpSqlStorage,initializePaperScalpSqlSnapshot,PAPER_SCALP_LEDGER_SQL}=await import(sql);
const initial=()=>({schemaVersion:1,marketId:'m1',revision:0,book:{orders:[],fills:[],owned:0,cashFlow:0},cycle:{marketId:'m1'},processedEventIds:[]});
const mockDb=()=>{
 const rows=new Map();
 return {prepare(sql){let args=[];return {bind(...v){args=v;return this;},async first(){
  if(!sql.startsWith('SELECT'))throw Error('unexpected query');
  const value=rows.get(args[0]);return value?{revision:value.revision,snapshot_json:value.json}:null;
 },async run(){
  if(sql.startsWith('INSERT')){if(rows.has(args[0]))return {meta:{changes:0}};
   rows.set(args[0],{revision:args[1],json:args[2]});return {meta:{changes:1}};}
  if(sql.startsWith('UPDATE')){const row=rows.get(args[2]);if(!row||row.revision!==args[3])return {meta:{changes:0}};
   rows.set(args[2],{revision:args[0],json:args[1]});return {meta:{changes:1}};}
  throw Error('unexpected statement');
 }};}},rows};
};
test('SQL paper ledger initializes once and persists CAS revisions',async()=>{
 assert.match(PAPER_SCALP_LEDGER_SQL,/PRIMARY KEY/);
 const db=mockDb(),storage=createPaperScalpSqlStorage(db);
 assert.equal(await initializePaperScalpSqlSnapshot(db,initial()),true);
 assert.equal(await initializePaperScalpSqlSnapshot(db,initial()),false);
 const next={...initial(),revision:1,processedEventIds:['evt1']};
 assert.equal(await storage.compareAndSwap('m1',0,next),true);
 assert.equal(await storage.compareAndSwap('m1',0,next),false);
 assert.equal((await storage.read('m1')).revision,1);
});
test('SQL paper ledger rejects invalid transitions and tampered recovery',async()=>{
 const db=mockDb(),storage=createPaperScalpSqlStorage(db);
 assert.equal(await storage.compareAndSwap('m1',0,{...initial(),revision:2}),false);
 await initializePaperScalpSqlSnapshot(db,initial());
 db.rows.get('m1').json=JSON.stringify({...initial(),book:{...initial().book,owned:3}});
 await assert.rejects(()=>storage.read('m1'),/invalid_stored_snapshot/);
});

test('rejects mismatch between SQL revision and serialized ledger',async()=>{
 const db=mockDb(),storage=createPaperScalpSqlStorage(db);
 await initializePaperScalpSqlSnapshot(db,initial());
 db.rows.get('m1').revision=1;
 await assert.rejects(()=>storage.read('m1'),/invalid_stored_snapshot/);
});
