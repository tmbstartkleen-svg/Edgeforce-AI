'use client';
import {useEffect,useState} from 'react';

type Rollback={
 rollbackConfirmed:boolean;failedCommitSha:string;restoredDeploymentId?:string|null;
 restoredDeploymentUrl?:string|null;workflowRunId?:string|null;createdAt:string;
 promotionReconciled:boolean;verificationInvalidated:boolean;
};
type Payload={latest:Rollback|null};

export default function RollbackReconciliationPanel(){
 const [data,setData]=useState<Payload|null>(null);
 useEffect(()=>{let active=true;const load=async()=>{try{const r=await fetch('/api/release/rollback-reconciliation',{cache:'no-store'});const j=await r.json();if(active&&r.ok)setData(j)}catch{}};void load();const t=window.setInterval(()=>void load(),120000);return()=>{active=false;window.clearInterval(t)}},[]);
 const x=data?.latest;
 return <section className="v21Panel">
  <div className="v21PanelHead"><div><div className="eyebrow">V101 ROLLBACK RECONCILIATION</div><h3>Rollback Evidence Integrity</h3></div><div className="panelMeta"><span>{x?.rollbackConfirmed?'ROLLBACK RECONCILED':'NO CURRENT ROLLBACK'}</span><span>{x?.workflowRunId||'—'}</span></div></div>
  <div className="v21Stats">
   <div><small>FAILED SHA</small><strong>{x?.failedCommitSha?.slice(0,8)||'—'}</strong><span>invalidated release</span></div>
   <div><small>PROMOTION</small><strong>{x?.promotionReconciled?'REVOKED':'—'}</strong><span>provenance state</span></div>
   <div><small>LIVE CERT</small><strong>{x?.verificationInvalidated?'INVALIDATED':'—'}</strong><span>post-promotion state</span></div>
   <div><small>RESTORE</small><strong>{x?.rollbackConfirmed?'CONFIRMED':'—'}</strong><span>previous deployment</span></div>
  </div>
  <div className="historyNote">V101 prevents a failed production release from retaining stale green evidence after rollback by reconciling promotion provenance, live verification, and restored deployment identity.</div>
 </section>;
}
