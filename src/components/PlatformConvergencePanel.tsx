'use client';
import {useEffect,useState} from 'react';
type Item={certified:boolean;commitSha:string;vercelVerified:boolean;cloudflareVerified:boolean;vercelUrl?:string|null;cloudflareUrl?:string|null;updatedAt:string};
export default function PlatformConvergencePanel(){
 const [x,setX]=useState<Item|null>(null);
 useEffect(()=>{let a=true;const load=async()=>{try{const r=await fetch('/api/release/platform-convergence',{cache:'no-store'});const j=await r.json();if(a&&r.ok)setX(j.latest||null)}catch{}};void load();const t=window.setInterval(()=>void load(),120000);return()=>{a=false;window.clearInterval(t)}},[]);
 return <section className="v21Panel">
  <div className="v21PanelHead"><div><div className="eyebrow">V103 PLATFORM CONVERGENCE</div><h3>Cross-Platform Production Identity</h3></div><div className="panelMeta"><span>{x?.certified?'CONVERGED':'AWAITING CONVERGENCE'}</span></div></div>
  <div className="v21Stats">
   <div><small>COMMIT</small><strong>{x?.commitSha?.slice(0,8)||'—'}</strong><span>shared production SHA</span></div>
   <div><small>VERCEL</small><strong>{x?.vercelVerified?'PASS':'—'}</strong><span>runtime identity</span></div>
   <div><small>CLOUDFLARE</small><strong>{x?.cloudflareVerified?'PASS':'—'}</strong><span>runtime identity</span></div>
   <div><small>STATE</small><strong>{x?.certified?'PASS':'PENDING'}</strong><span>cross-platform</span></div>
  </div>
  <div className="historyNote">V103 certifies production convergence only when Vercel and Cloudflare report the same release, model, migration, and commit identity.</div>
 </section>;
}
