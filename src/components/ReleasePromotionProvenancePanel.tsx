'use client';
import {useEffect,useState} from 'react';

type Promotion={
 promoted:boolean;rolledBack:boolean;releaseVersion:string;modelVersion:string;migrationVersion:number;
 commitSha:string;platform:string;deploymentUrl:string;workflowRunId?:string|null;createdAt:string;blockers?:string[];
};
type Payload={current:Promotion|null;latest:Promotion|null};

export default function ReleasePromotionProvenancePanel(){
 const [data,setData]=useState<Payload|null>(null);
 useEffect(()=>{let active=true;const load=async()=>{try{const r=await fetch('/api/release/promotion-provenance',{cache:'no-store'});const j=await r.json();if(active&&r.ok)setData(j)}catch{}};void load();const t=window.setInterval(()=>void load(),120000);return()=>{active=false;window.clearInterval(t)}},[]);
 const p=data?.current;
 const healthy=Boolean(p?.promoted&&!p?.rolledBack&&!p?.blockers?.length);
 return <section className="v21Panel">
  <div className="v21PanelHead"><div><div className="eyebrow">V99 PROMOTION PROVENANCE</div><h3>Production Commit & Promotion Ledger</h3></div><div className="panelMeta"><span>{healthy?'PROVENANCE VERIFIED':'AWAITING PROVENANCE'}</span><span>{p?.platform||'—'}</span></div></div>
  <div className="v21Stats">
   <div><small>RELEASE</small><strong>{p?.releaseVersion||'—'}</strong><span>promoted runtime</span></div>
   <div><small>COMMIT</small><strong>{p?.commitSha?.slice(0,8)||'—'}</strong><span>production SHA</span></div>
   <div><small>WORKFLOW</small><strong>{p?.workflowRunId||'—'}</strong><span>promotion run</span></div>
   <div><small>MIGRATION</small><strong>{p?.migrationVersion??'—'}</strong><span>schema identity</span></div>
  </div>
  <div className="historyNote">V99 records the exact commit, release/model/schema identity, platform, deployment URL, workflow run, strict certification, canary and V1-readiness evidence for every successful production promotion.</div>
 </section>;
}
