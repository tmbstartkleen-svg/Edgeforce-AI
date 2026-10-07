'use client';
import {useEffect,useState} from 'react';

type Item={
 certified:boolean;
 commitSha:string;
 vercelVerified:boolean;
 cloudflareVerified:boolean;
 vercelUrl?:string|null;
 cloudflareUrl?:string|null;
 evidence?:{
  topology?:string;
  primary?:{commitSha?:string;deploymentUrl?:string;platformReady?:boolean;hostedSmokePassed?:boolean};
  standby?:{commitSha?:string;deploymentUrl?:string;state?:string;healthy?:boolean;manualOnly?:boolean;commitDrift?:boolean};
 };
 updatedAt:string;
};

export default function PlatformConvergencePanel(){
 const [x,setX]=useState<Item|null>(null);
 useEffect(()=>{let a=true;const load=async()=>{try{const r=await fetch('/api/release/platform-convergence',{cache:'no-store'});const j=await r.json();if(a&&r.ok)setX(j.latest||null)}catch{}};void load();const t=window.setInterval(()=>void load(),120000);return()=>{a=false;window.clearInterval(t)}},[]);
 const standby=x?.evidence?.standby;
 const primary=x?.evidence?.primary;
 const topology=x?.evidence?.topology;
 return <section className="v21Panel">
  <div className="v21PanelHead"><div><div className="eyebrow">V145 PRIMARY / STANDBY TOPOLOGY</div><h3>Cloudflare Production + Vercel Disaster Recovery</h3></div><div className="panelMeta"><span>{x?.certified?'TOPOLOGY READY':'AWAITING EVIDENCE'}</span></div></div>
  <div className="v21Stats">
   <div><small>PRIMARY</small><strong>{x?.cloudflareVerified?'READY':'—'}</strong><span>Cloudflare {primary?.commitSha?.slice(0,8)||x?.commitSha?.slice(0,8)||'—'}</span></div>
   <div><small>STANDBY</small><strong>{x?.vercelVerified?'READY':'—'}</strong><span>Vercel {standby?.state||'unknown'}</span></div>
   <div><small>STANDBY SHA</small><strong>{standby?.commitSha?.slice(0,8)||'—'}</strong><span>{standby?.commitDrift?'drift allowed':'aligned/unknown'}</span></div>
   <div><small>POLICY</small><strong>{topology==='cloudflare-primary-vercel-standby'?'PASS':'LEGACY'}</strong><span>manual DR standby</span></div>
  </div>
  <div className="historyNote">V145 requires the Cloudflare primary to be exact-main certified and healthy, while Vercel remains a READY manual disaster-recovery standby. The standby is not required to run the same commit until a failover is actually initiated.</div>
 </section>;
}
