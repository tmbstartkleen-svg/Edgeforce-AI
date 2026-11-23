import {validatePaperLedgerSnapshot,type ScalpLedgerSnapshot} from './paperScalpLedger';
import {dispatchPaperScalpFromQuotes} from './paperScalpQuoteDispatcher';
import type {NormalizedMarketBook} from './readOnlyScalpMarketBook';
import type {ScalpRankSettings} from './crossVenuePaperScalpRanking';

/** Recovery-safe paper dispatcher. Pure function, no persistent writes or exchange calls.
 * A caller must atomically persist the returned snapshot before using it again.
 */
export type LedgerDispatchResult={
 status:'blocked'|'waiting'|'paper_order_created';
 reason:string;state:ScalpLedgerSnapshot;orderId:string|null;
};
export function dispatchPaperScalpWithLedger(
 state:ScalpLedgerSnapshot,expectedRevision:number,
 books:NormalizedMarketBook[],settings:ScalpRankSettings,nowMs:number
):LedgerDispatchResult{
 const reject=(reason:string):LedgerDispatchResult=>({
  status:'blocked',reason,state,orderId:null
 });
 if(!validatePaperLedgerSnapshot(state))return reject('invalid_recovery_snapshot');
 if(!Number.isSafeInteger(expectedRevision)||expectedRevision!==state.revision)
  return reject('revision_conflict');
 if(state.revision===Number.MAX_SAFE_INTEGER)return reject('revision_exhausted');
 const result=dispatchPaperScalpFromQuotes(
  books,settings,state.book,state.cycle,nowMs
 );
 if(result.status!=='paper_order_created')return {
  status:result.status,reason:result.reason,state,orderId:null
 };
 if(!result.orderId||result.book.orders.length!==state.book.orders.length+1||
  result.book.orders.some(o=>o.id===result.orderId&&o.status!=='open'))
  return reject('invalid_dispatched_order');
 const next:ScalpLedgerSnapshot={
  ...state,revision:state.revision+1,book:result.book,cycle:result.cycle,
  processedEventIds:[...state.processedEventIds,'paper-dispatch:'+result.orderId]
 };
 if(!validatePaperLedgerSnapshot(next))return reject('invalid_post_dispatch_snapshot');
 return {status:'paper_order_created',reason:result.reason,state:next,orderId:result.orderId};
}
