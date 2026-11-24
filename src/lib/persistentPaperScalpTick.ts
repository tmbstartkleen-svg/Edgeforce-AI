import {validatePaperLedgerSnapshot} from './paperScalpLedger';
import {dispatchPaperScalpWithLedger} from './paperScalpLedgerDispatcher';
import {persistPaperScalpSnapshot,type PaperScalpLedgerStorage} from './paperScalpDurableStorage';
import type {NormalizedMarketBook} from './readOnlyScalpMarketBook';
import type {ScalpRankSettings} from './crossVenuePaperScalpRanking';

export type PaperTickResult={
 status:'blocked'|'waiting'|'paper_order_created';
 reason:string;orderId:string|null;revision:number|null;
};

/** One paper-only tick. Never acknowledges an order before durable CAS. */
export async function runPersistentPaperTick(
 storage:PaperScalpLedgerStorage,marketId:string,books:NormalizedMarketBook[],
 settings:ScalpRankSettings,nowMs:number
):Promise<PaperTickResult>{
 const blocked=(reason:string):PaperTickResult=>({status:'blocked',reason,orderId:null,revision:null});
 if(!marketId||!Number.isFinite(nowMs))return blocked('invalid_tick');
 try{
  const state=await storage.read(marketId);
  if(!validatePaperLedgerSnapshot(state)||state.marketId!==marketId)
   return blocked('invalid_recovery_snapshot');
  const result=dispatchPaperScalpWithLedger(state,state.revision,books,settings,nowMs);
  if(result.status!=='paper_order_created')
   return {status:result.status,reason:result.reason,orderId:null,revision:state.revision};
  const persisted=await persistPaperScalpSnapshot(storage,state,result.state);
  if(persisted.status!=='saved'||!persisted.snapshot)return blocked(persisted.reason);
  return {status:'paper_order_created',reason:'committed',orderId:result.orderId,revision:persisted.snapshot.revision};
 }catch{return blocked('paper_tick_unavailable');}
}
