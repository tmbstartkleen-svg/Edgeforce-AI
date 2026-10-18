// Offline evidence-only restore certification. Requires two distinct snapshot identities,
// exact restored hashes, and separate observed read tests; never invokes database restore.
import fs from 'node:fs';
const [sourcePath,restoredPath]=process.argv.slice(2);
const tables=['teams','athletes','events','market_snapshots','player_game_stats','injury_snapshots','weather_snapshots','model_runs','bet_results','calibration_metrics'];
const blocked=(reason)=>{console.error('D1_RESTORE_EVIDENCE_BLOCKED: '+reason);process.exitCode=1};
if(!sourcePath||!restoredPath){blocked('SOURCE_AND_RESTORED_MANIFEST_REQUIRED');}
else try{
 const original=JSON.parse(fs.readFileSync(sourcePath,'utf8')),restored=JSON.parse(fs.readFileSync(restoredPath,'utf8'));
 const validIdentity=x=>typeof x?.snapshotId==='string'&&/^[a-zA-Z0-9_-]{8,128}$/.test(x.snapshotId);
 if(!validIdentity(original)||!validIdentity(restored)||original.snapshotId===restored.snapshotId)throw Error('MISSING_INDEPENDENT_RESTORE_IDENTITY');
 if(restored.sourceSnapshotId!==original.snapshotId)throw Error('RESTORED_SNAPSHOT_PROVENANCE_MISMATCH');
 if(restored.restoreTestPassed!==true||restored.restoreTestEnvironment!=='ISOLATED'||restored.readVerificationPassed!==true)throw Error('RESTORE_TEST_EVIDENCE_MISSING');
 const read=x=>{if(!Array.isArray(x.tables))throw Error('MISSING_TABLES');const m=new Map();for(const t of x.tables){if(!tables.includes(t?.table)||m.has(t.table)||!Number.isSafeInteger(t.count)||t.count<1||!/^[0-9a-f]{64}$/.test(t.sha256))throw Error('INVALID_TABLE_EVIDENCE');m.set(t.table,t);}return m;};
 const a=read(original),b=read(restored);
 const comparisons=tables.map(table=>({table,match:a.has(table)&&b.has(table)&&a.get(table).count===b.get(table).count&&a.get(table).sha256===b.get(table).sha256}));
 const complete=comparisons.every(x=>x.match);
 console.log(JSON.stringify({kind:'EDGEFORCE_D1_RESTORE_EVIDENCE',complete,comparisons,independentlyAuthenticated:false,productionCutoverAuthorized:false},null,2));
 if(!complete)process.exitCode=1;
}catch(e){blocked(e instanceof Error?e.message:'INVALID_MANIFEST');}
