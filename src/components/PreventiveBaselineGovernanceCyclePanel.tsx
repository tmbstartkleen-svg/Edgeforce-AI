'use client';
import {useEffect,useState} from 'react';
type Payload={status:string;cycleKey:string|null;lockActive:boolean;lockHolder:string|null;lockedUntil:string|null;recent:Array<{status:string}>};
export default function PreventiveBaselineGovernanceCyclePanel(){
 const [data,setData]=useState<Payload|null>(null);
 useEffect(()=>{let active=true;const load=async()=>{try{const r=await fetch('/api/operations/preventive-baseline-governance-cycle',{cache:'no-store'});const j=await r.json();if(active&&r.ok)setData(j)}catch{}};void load();const t=window.setInterval(()=>void load(),120000);return()=>{active=false;window.clearInterval(t)}},[]);
 return <section className="v21Panel">
  <div className="v21PanelHead"><div><div className="eyebrow">V94 GOVERNANCE CYCLE</div><h3>Idempotency, Lease Locking & Transition Journal</h3></div><div className="panelMeta"><span>{data?.status||'LOADING'}</span><span>{data?.lockActive?'LOCK ACTIVE':'UNLOCKED'}</span></div></div>
  <div className="v21Stats">
   <div><small>CYCLE</small><strong>{data?.cycleKey?'ACTIVE':'—'}</strong><span>minute-bucket idempotency</span></div>
   <div><small>LOCK</small><strong>{data?.lockActive?'HELD':'FREE'}</strong><span>90-second lease</span></div>
   <div><small>HOLDER</small><strong>{data?.lockHolder||'—'}</strong><span>model version</span></div>
   <div><small>RECENT</small><strong>{data?.recent?.length||0}</strong><span>journaled cycles</span></div>
  </div>
  <div className="historyNote">V94 prevents overlapping baseline-governance cycles and makes repeated supervision calls idempotent within each minute bucket.</div>
 </section>;
}
