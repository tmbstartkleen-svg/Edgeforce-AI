import {validatePaperLedgerSnapshot,type ScalpLedgerSnapshot} from './paperScalpLedger';

/** Storage-agnostic, compare-and-swap persistence contract.
 * Implementations MUST atomically enforce revision matching across processes.
 * This adapter never calls an exchange or places an order.
 */
export interface PaperScalpLedgerStorage {
 read(marketId:string):Promise<unknown>;
 compareAndSwap(marketId:string,expectedRevision:number,next:ScalpLedgerSnapshot):Promise<boolean>;
}
export type PersistResult={
 status:'saved'|'blocked'|'conflict';reason:string;
 snapshot:ScalpLedgerSnapshot|null;
};
export async function persistPaperScalpSnapshot(
 storage:PaperScalpLedgerStorage,previous:ScalpLedgerSnapshot,
 next:ScalpLedgerSnapshot
):Promise<PersistResult>{
 const fail=(status:PersistResult['status'],reason:string):PersistResult=>({status,reason,snapshot:null});
 if(!validatePaperLedgerSnapshot(previous)||!validatePaperLedgerSnapshot(next))
  return fail('blocked','invalid_snapshot');
 if(previous.marketId!==next.marketId||next.revision!==previous.revision+1||
  next.revision>Number.MAX_SAFE_INTEGER||!Number.isSafeInteger(next.revision))
  return fail('blocked','invalid_revision_transition');
 if(next.processedEventIds.length!==previous.processedEventIds.length+1||
  !previous.processedEventIds.every((id,i)=>next.processedEventIds[i]===id))
  return fail('blocked','non_append_only_event_history');
 if(typeof storage?.read!=='function'||typeof storage.compareAndSwap!=='function')
  return fail('blocked','missing_atomic_storage');
 try{
  const current=await storage.read(previous.marketId);
  if(!validatePaperLedgerSnapshot(current)||current.revision!==previous.revision)
   return fail('conflict','storage_revision_conflict');
  const saved=await storage.compareAndSwap(previous.marketId,previous.revision,next);
  return saved?{status:'saved',reason:'committed',snapshot:next}:fail('conflict','atomic_compare_and_swap_failed');
 }catch{return fail('blocked','storage_unavailable');}
}
