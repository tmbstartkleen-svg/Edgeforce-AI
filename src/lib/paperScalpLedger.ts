import {applyPaperEvent,type PaperBook,type PaperEvent} from './paperScalpOrderEngine';
import type {PaperScalpCycle} from './paperAutomatedScalpCycle';

/** Pure persistence boundary; the caller must durably write the resulting snapshot.
 * This module does not connect to an exchange, database or live order endpoint.
 */
export type ScalpLedgerSnapshot={
 schemaVersion:1;marketId:string;revision:number;
 book:PaperBook;cycle:PaperScalpCycle;processedEventIds:string[];
};
export type LedgerResult={accepted:boolean;reason:string;state:ScalpLedgerSnapshot};
const clone=(s:ScalpLedgerSnapshot):ScalpLedgerSnapshot=>({
 ...s,book:{...s.book,orders:s.book.orders.map(o=>({...o})),fills:s.book.fills.map(f=>({...f}))},
 cycle:{...s.cycle},processedEventIds:[...s.processedEventIds]
});
export function applyDurablePaperEvent(
 state:ScalpLedgerSnapshot,eventId:string,expectedRevision:number,event:PaperEvent
):LedgerResult{
 const reject=(reason:string):LedgerResult=>({accepted:false,reason,state});
 if(!state||state.schemaVersion!==1||!state.marketId||
 !Number.isSafeInteger(state.revision)||state.revision<0||
 !Array.isArray(state.processedEventIds)||!state.book||!state.cycle||
 state.cycle.marketId!==state.marketId)return reject('invalid_snapshot');
 if(!eventId||eventId.length>160)return reject('invalid_event_id');
 if(state.processedEventIds.includes(eventId))return reject('duplicate_event');
 if(!Number.isSafeInteger(expectedRevision)||expectedRevision!==state.revision)return reject('revision_conflict');
 if(state.revision===Number.MAX_SAFE_INTEGER)return reject('revision_exhausted');
 const transition=applyPaperEvent(state.book,event);
 if(!transition.accepted)return reject(transition.reason??'invalid_paper_event');
 const next=clone(state);
 next.book=transition.book;next.revision+=1;next.processedEventIds.push(eventId);
 return {accepted:true,reason:'accepted',state:next};
}
export function validatePaperLedgerSnapshot(value:unknown):value is ScalpLedgerSnapshot{
 if(!value||typeof value!=='object')return false;
 const s=value as Partial<ScalpLedgerSnapshot>;
 if(s.schemaVersion!==1||typeof s.marketId!=='string'||!s.marketId||
 !Number.isSafeInteger(s.revision)||s.revision!<0||
 !Array.isArray(s.processedEventIds)||new Set(s.processedEventIds).size!==s.processedEventIds.length||
 !s.cycle||s.cycle.marketId!==s.marketId||!s.book||
 !Array.isArray(s.book.orders)||!Array.isArray(s.book.fills)||
 !Number.isSafeInteger(s.book.owned)||s.book.owned<0||!Number.isFinite(s.book.cashFlow))return false;
 const orderIds=new Set<string>();
 for(const o of s.book.orders){
  if(!o||typeof o.id!=='string'||!o.id||orderIds.has(o.id)||!['buy','sell'].includes(o.side)||
  !Number.isFinite(o.limitPrice)||o.limitPrice<=0||o.limitPrice>=1||
  !Number.isSafeInteger(o.quantity)||o.quantity<=0||
  !Number.isSafeInteger(o.filled)||o.filled<0||o.filled>o.quantity||
  !['open','partially_filled','filled','cancelled'].includes(o.status))return false;
  orderIds.add(o.id);
 }
 const fillIds=new Set<string>();let net=0,flow=0;
 for(const f of s.book.fills){
  if(!f||typeof f.id!=='string'||!f.id||fillIds.has(f.id)||!orderIds.has(f.orderId)||
  !Number.isSafeInteger(f.quantity)||f.quantity<=0||
  !Number.isFinite(f.price)||f.price<=0||f.price>=1)return false;
  fillIds.add(f.id);
  const order=s.book.orders.find(o=>o.id===f.orderId)!;
  net+=order.side==='buy'?f.quantity:-f.quantity;
  flow+=(order.side==='buy'?-1:1)*f.quantity*f.price;
 }
 return net===s.book.owned&&Math.abs(flow-s.book.cashFlow)<1e-7;
}
