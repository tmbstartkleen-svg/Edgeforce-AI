import {validatePaperScalpSnapshot,type PaperScalpSnapshot} from './paperScalpSnapshot';

/**
 * Storage-neutral optimistic concurrency boundary. The adapter must implement
 * atomic compare-and-swap in its database transaction, never read-then-write.
 * Research-only: no live exchange orders.
 */
export type ScalpSnapshotStore={
 read:(marketId:string)=>Promise<{revision:number;payload:string}|null>;
 compareAndSwap:(marketId:string,expectedRevision:number|null,nextRevision:number,payload:string)=>Promise<boolean>;
};
export type RestoreResult={status:'restored'|'missing'|'invalid'|'storage_error';snapshot:PaperScalpSnapshot|null;reason:string};
export async function restorePaperScalp(store:ScalpSnapshotStore,marketId:string):Promise<RestoreResult>{
 if(!marketId)return {status:'invalid',snapshot:null,reason:'missing_market_id'};
 try{
  const row=await store.read(marketId);
  if(!row)return {status:'missing',snapshot:null,reason:'no_persisted_state'};
  if(!Number.isSafeInteger(row.revision)||row.revision<0)return {status:'invalid',snapshot:null,reason:'invalid_stored_revision'};
  const parsed=JSON.parse(row.payload) as PaperScalpSnapshot;
  if(parsed?.cycle?.marketId!==marketId||parsed?.revision!==row.revision||!validatePaperScalpSnapshot(parsed).valid)
   return {status:'invalid',snapshot:null,reason:'invalid_persisted_snapshot'};
  return {status:'restored',snapshot:parsed,reason:'validated_snapshot'};
 }catch{
  return {status:'storage_error',snapshot:null,reason:'read_or_parse_failed'};
 }
}
export async function persistPaperScalp(
 store:ScalpSnapshotStore,marketId:string,next:PaperScalpSnapshot,expectedRevision:number|null
):Promise<{saved:boolean;reason:string}>{
 if(!marketId||next?.cycle?.marketId!==marketId||!validatePaperScalpSnapshot(next).valid||
  (expectedRevision===null?next.revision!==0:
   !Number.isSafeInteger(expectedRevision)||expectedRevision<0||next.revision!==expectedRevision+1))
  return {saved:false,reason:'invalid_snapshot_or_revision'};
 try{
  const saved=await store.compareAndSwap(marketId,expectedRevision,next.revision,JSON.stringify(next));
  return {saved,reason:saved?'persisted':'concurrent_update_or_store_rejected'};
 }catch{return {saved:false,reason:'storage_write_failed'};}
}
