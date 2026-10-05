'use client';
import {useEffect,useState} from 'react';
type Item={closed:boolean;commitSha:string;executionCertified:boolean;promotionVerified:boolean;postPromotionVerified:boolean;platformConverged:boolean;rollbackClear:boolean;createdAt:string};
export default function FinalProductionClosurePanel(){
 const [x,setX]=useState<Item|null>(null);
 useEffect(()=>{let a=true;const load=async()=>{try{const r=await fetch('/api/release/final-closure',{cache:'no-store'});const j=await r.json();if(a&&r.ok)setX(j.latest||null)}catch{}};void load();const t=window.setInterval(()=>void load(),120000);return()=>{a=false;window.clearInterval(t)}},[]);
 return <section className="v21Panel">
  <div className="v21PanelHead"><div><div className="eyebrow">V104 FINAL PRODUCTION CLOSURE</div><h3>Release Closure Certificate</h3></div><div className="panelMeta"><span>{x?.closed?'CLOSED':'PENDING'}</span></div></div>
  <div className="v21Stats">
   <div><small>COMMIT</small><strong>{x?.commitSha?.slice(0,8)||'—'}</strong><span>closure SHA</span></div>
   <div><small>RELEASE</small><strong>{x?.executionCertified&&x?.promotionVerified&&x?.postPromotionVerified?'PASS':'—'}</strong><span>execution + promotion + live</span></div>
   <div><small>PLATFORMS</small><strong>{x?.platformConverged?'PASS':'—'}</strong><span>Vercel + Cloudflare</span></div>
   <div><small>ROLLBACK</small><strong>{x?.rollbackClear?'CLEAR':'—'}</strong><span>revocation integrity</span></div>
  </div>
  <div className="historyNote">V104 closes a release only after every durable production evidence chain agrees on the same commit.</div>
 </section>;
}
