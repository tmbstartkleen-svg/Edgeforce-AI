'use client';
import {useEffect,useState} from 'react';
type Item={
 closed:boolean;
 commitSha:string;
 executionCertified:boolean;
 promotionVerified:boolean;
 postPromotionVerified:boolean;
 platformConverged:boolean;
 rollbackClear:boolean;
 evidence?:{topology?:string;standbyCommitDrift?:boolean;standbyCommitSha?:string|null};
 createdAt:string;
};
export default function FinalProductionClosurePanel(){
 const [x,setX]=useState<Item|null>(null);
 useEffect(()=>{let a=true;const load=async()=>{try{const r=await fetch('/api/release/final-closure',{cache:'no-store'});const j=await r.json();if(a&&r.ok)setX(j.latest||null)}catch{}};void load();const t=window.setInterval(()=>void load(),120000);return()=>{a=false;window.clearInterval(t)}},[]);
 return <section className="v21Panel">
  <div className="v21PanelHead"><div><div className="eyebrow">V145 PRODUCTION CLOSURE</div><h3>Primary / Standby Release Certificate</h3></div><div className="panelMeta"><span>{x?.closed?'CLOSED':'PENDING'}</span></div></div>
  <div className="v21Stats">
   <div><small>PRIMARY SHA</small><strong>{x?.commitSha?.slice(0,8)||'—'}</strong><span>Cloudflare release</span></div>
   <div><small>PRIMARY</small><strong>{x?.executionCertified&&x?.promotionVerified&&x?.postPromotionVerified?'PASS':'—'}</strong><span>certified + live + smoked</span></div>
   <div><small>STANDBY</small><strong>{x?.platformConverged?'READY':'—'}</strong><span>Vercel manual DR</span></div>
   <div><small>ROLLBACK</small><strong>{x?.rollbackClear?'CLEAR':'—'}</strong><span>primary revocation integrity</span></div>
  </div>
  <div className="historyNote">V145 closes production when the Cloudflare primary is exactly certified and healthy, the Vercel disaster-recovery standby is READY and healthy, and no rollback invalidates the primary. Standby commit drift is expected until failover.</div>
 </section>;
}
