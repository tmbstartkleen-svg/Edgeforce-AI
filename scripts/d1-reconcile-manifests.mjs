import fs from 'node:fs';
const names=['teams','athletes','events','market_snapshots','player_game_stats','injury_snapshots','weather_snapshots','model_runs','bet_results','calibration_metrics'];
const [sourceFile,targetFile]=process.argv.slice(2);
function fail(reason){console.error('D1_RECONCILIATION_BLOCKED: '+reason);process.exitCode=1}
if(!sourceFile||!targetFile)fail('USAGE: node scripts/d1-reconcile-manifests.mjs SOURCE_JSON TARGET_JSON');
else{
 try{
  const source=JSON.parse(fs.readFileSync(sourceFile,'utf8'));
  const target=JSON.parse(fs.readFileSync(targetFile,'utf8'));
  const rows=obj=>Array.isArray(obj)?obj:obj?.tables;
  const read=obj=>{
   if(!Array.isArray(rows(obj)))throw Error('MALFORMED_MANIFEST');
   const map=new Map();
   for(const item of rows(obj)){
    if(!item||!names.includes(item.table)||map.has(item.table)||!Number.isSafeInteger(item.count)||item.count<0||typeof item.sha256!=='string'||!/^[0-9a-f]{64}$/.test(item.sha256))throw Error('INVALID_TABLE_EVIDENCE');
    map.set(item.table,{count:item.count,sha256:item.sha256});
   }
   return map;
  };
  const a=read(source),b=read(target);
  const comparison=names.map(table=>{const x=a.get(table),y=b.get(table);return {table,sourceCount:x?.count??null,targetCount:y?.count??null,countsMatch:!!x&&!!y&&x.count===y.count,hashesMatch:!!x&&!!y&&x.sha256===y.sha256}});
  const complete=comparison.every(x=>x.countsMatch&&x.hashesMatch&&x.sourceCount>0);
  console.log(JSON.stringify({kind:'EDGEFORCE_D1_RECONCILIATION',complete,comparisons:comparison,cutoverAuthorized:false,backupRestoreVerified:false,productionDataTransferred:false},null,2));
  if(!complete)process.exitCode=1;
 }catch{fail('INVALID_OR_MISSING_MANIFEST');}
}
