import type {PaperBook} from './paperScalpOrderEngine';
import type {PaperScalpCycle} from './paperAutomatedScalpCycle';

/**
 * JSON-safe, versioned snapshot for an external durable store.
 * No database/network calls: caller must persist atomically with compare-and-swap.
 */
export type PaperScalpSnapshot={version:1;revision:number;cycle:PaperScalpCycle;book:PaperBook};
export type SnapshotValidation={valid:boolean;reasons:string[]};
export function validatePaperScalpSnapshot(s:PaperScalpSnapshot):SnapshotValidation{
 const reasons:string[]=[];
 if(!s||s.version!==1||!Number.isSafeInteger(s.revision)||s.revision<0)return {valid:false,reasons:['invalid_snapshot_version_or_revision']};
 const {book,cycle}=s;
 if(!cycle||!cycle.marketId||!Number.isSafeInteger(cycle.nextOrderSequence)||cycle.nextOrderSequence<0||
  !Number.isSafeInteger(cycle.maxPosition)||cycle.maxPosition<=0||
  typeof cycle.enabled!=='boolean'||typeof cycle.killSwitch!=='boolean'||
  ![cycle.maxBuyPrice,cycle.targetNetPerContract,cycle.buyFeePerContract,cycle.sellFeePerContract].every(x=>Number.isFinite(x)&&x>=0)||
  cycle.maxBuyPrice<=0||cycle.maxBuyPrice>=1)reasons.push('invalid_cycle');
 if(!book||!Array.isArray(book.orders)||!Array.isArray(book.fills)||
  !Number.isSafeInteger(book.owned)||book.owned<0||!Number.isFinite(book.cashFlow))return {valid:false,reasons:[...reasons,'invalid_book']};
 const ids=new Set<string>();const orders=new Map<string,PaperBook['orders'][number]>();
 for(const o of book.orders){
  if(!o||typeof o.id!=='string'||!o.id||ids.has(o.id)||!['buy','sell'].includes(o.side)||
   !Number.isFinite(o.limitPrice)||o.limitPrice<=0||o.limitPrice>=1||
   !Number.isSafeInteger(o.quantity)||o.quantity<=0||!Number.isSafeInteger(o.filled)||o.filled<0||o.filled>o.quantity||
   !['open','partially_filled','filled','cancelled'].includes(o.status)||
   (o.status==='filled'&&o.filled!==o.quantity)||
   (o.status==='open'&&o.filled!==0)||
   (o.status==='partially_filled'&&(o.filled===0||o.filled===o.quantity))){
   reasons.push('invalid_order');continue;
  }
  ids.add(o.id);orders.set(o.id,o);
 }
 const fillIds=new Set<string>();const filledByOrder=new Map<string,number>();
 let inventory=0,cashFlow=0;
 for(const f of book.fills){
  if(!f||typeof f.id!=='string'||!f.id||fillIds.has(f.id)||!orders.has(f.orderId)||
   !Number.isSafeInteger(f.quantity)||f.quantity<=0||!Number.isFinite(f.price)||f.price<=0||f.price>=1){
   reasons.push('invalid_fill');continue;
  }
  fillIds.add(f.id);const o=orders.get(f.orderId)!;
  if(o.side==='buy'&&f.price>o.limitPrice||o.side==='sell'&&f.price<o.limitPrice)reasons.push('fill_outside_limit');
  filledByOrder.set(o.id,(filledByOrder.get(o.id)??0)+f.quantity);
  inventory+=(o.side==='buy'?1:-1)*f.quantity;
  cashFlow+=(o.side==='buy'?-1:1)*f.quantity*f.price;
 }
 for(const o of orders.values())if((filledByOrder.get(o.id)??0)!==o.filled)reasons.push('fill_count_mismatch');
 if(inventory!==book.owned)reasons.push('inventory_mismatch');
 if(Math.abs(cashFlow-book.cashFlow)>1e-8)reasons.push('cashflow_mismatch');
 const reserved=book.orders.filter(o=>o?.side==='sell'&&['open','partially_filled'].includes(o.status)).reduce((n,o)=>n+o.quantity-o.filled,0);
 if(reserved>book.owned)reasons.push('oversubscribed_inventory');
 return {valid:reasons.length===0,reasons};
}
export function advanceSnapshotRevision(snapshot:PaperScalpSnapshot,expectedRevision:number,book:PaperBook,cycle:PaperScalpCycle):PaperScalpSnapshot|null{
 if(!validatePaperScalpSnapshot(snapshot).valid||snapshot.revision!==expectedRevision)return null;
 const next:PaperScalpSnapshot={version:1,revision:expectedRevision+1,book,cycle};
 return validatePaperScalpSnapshot(next).valid?next:null;
}
