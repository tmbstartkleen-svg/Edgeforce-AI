/**
 * Pure, paper-only order state reducer. Never connects to an exchange.
 * Duplicate fill IDs are ignored and sell fills cannot exceed owned inventory.
 */
export type PaperOrderSide='buy'|'sell';
export type PaperOrderStatus='open'|'partially_filled'|'filled'|'cancelled';
export type PaperOrder={id:string;side:PaperOrderSide;limitPrice:number;quantity:number;filled:number;status:PaperOrderStatus};
export type PaperFill={id:string;orderId:string;quantity:number;price:number};
export type PaperBook={orders:PaperOrder[];fills:PaperFill[];owned:number;cashFlow:number};
export type PaperEvent=
 |{type:'place';order:PaperOrder}
 |{type:'fill';fill:PaperFill}
 |{type:'cancel';orderId:string};
export type PaperTransition={accepted:boolean;reason:string|null;book:PaperBook};
export function applyPaperEvent(book:PaperBook,event:PaperEvent):PaperTransition{
 const reject=(reason:string):PaperTransition=>({accepted:false,reason,book});
 if(!book||!Array.isArray(book.orders)||!Array.isArray(book.fills)||
 !Number.isSafeInteger(book.owned)||book.owned<0||!Number.isFinite(book.cashFlow))return reject('invalid_book');
 if(event.type==='place'){
  const o=event.order;
  if(!o.id||book.orders.some(x=>x.id===o.id)||!['buy','sell'].includes(o.side)||
   !Number.isFinite(o.limitPrice)||o.limitPrice<=0||o.limitPrice>=1||
   !Number.isSafeInteger(o.quantity)||o.quantity<=0||o.filled!==0||o.status!=='open')return reject('invalid_order');
  if(o.side==='sell'){
   const reserved=book.orders.filter(x=>x.side==='sell'&&['open','partially_filled'].includes(x.status))
    .reduce((n,x)=>n+x.quantity-x.filled,0);
   if(o.quantity>book.owned-reserved)return reject('insufficient_unreserved_inventory');
  }
  return {accepted:true,reason:null,book:{...book,orders:[...book.orders,{...o}]}};
 }
 if(event.type==='cancel'){
  const index=book.orders.findIndex(o=>o.id===event.orderId);
  if(index<0||!['open','partially_filled'].includes(book.orders[index].status))return reject('order_not_cancellable');
  return {accepted:true,reason:null,book:{...book,orders:book.orders.map((o,i)=>i===index?{...o,status:'cancelled'}:o)}};
 }
 const f=event.fill;
 if(!f.id||book.fills.some(x=>x.id===f.id))return reject('duplicate_or_invalid_fill');
 const index=book.orders.findIndex(o=>o.id===f.orderId);
 if(index<0)return reject('unknown_order');
 const o=book.orders[index];
 if(!['open','partially_filled'].includes(o.status)||!Number.isSafeInteger(f.quantity)||f.quantity<=0||
 f.quantity>o.quantity-o.filled||!Number.isFinite(f.price)||f.price<=0||f.price>=1||
 (o.side==='buy'&&f.price>o.limitPrice)||(o.side==='sell'&&f.price<o.limitPrice))return reject('invalid_fill');
 if(o.side==='sell'&&f.quantity>book.owned)return reject('insufficient_inventory');
 const filled=o.filled+f.quantity;
 return {accepted:true,reason:null,book:{
  orders:book.orders.map((x,i)=>i===index?{...x,filled,status:filled===o.quantity?'filled':'partially_filled'}:x),
  fills:[...book.fills,{...f}],owned:book.owned+(o.side==='buy'?f.quantity:-f.quantity),
  cashFlow:book.cashFlow+(o.side==='buy'?-1:1)*f.quantity*f.price
 }};
}
