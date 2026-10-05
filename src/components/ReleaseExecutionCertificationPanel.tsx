'use client';
import {useEffect,useState} from 'react';

type Cert={
 certified:boolean;
 releaseVersion:string;
 modelVersion:string;
 migrationVersion:number;
 commitSha:string;
 source:string;
 createdAt:string;
 blockers?:string[];
};
type Payload={current:Cert|null;latest:Cert|null};

export default function ReleaseExecutionCertificationPanel(){
 const [data,setData]=useState<Payload|null>(null);
 useEffect(()=>{let active=true;const load=async()=>{try{const r=await fetch('/api/release/execution-certification',{cache:'no-store'});const j=await r.json();if(active&&r.ok)setData(j)}catch{}};void load();const t=window.setInterval(()=>void load(),120000);return()=>{active=false;window.clearInterval(t)}},[]);
 const cert=data?.current;
 return <section className="v21Panel">
  <div className="v21PanelHead"><div><div className="eyebrow">V97 RELEASE EXECUTION CERTIFICATE</div><h3>Compile, Smoke, Load & Hosted Evidence</h3></div><div className="panelMeta"><span>{cert?.certified?'CERTIFIED':'NOT CERTIFIED'}</span><span>{cert?.releaseVersion||'—'}</span></div></div>
  <div className="v21Stats">
   <div><small>RELEASE</small><strong>{cert?.releaseVersion||'—'}</strong><span>runtime identity</span></div>
   <div><small>MIGRATION</small><strong>{cert?.migrationVersion??'—'}</strong><span>schema identity</span></div>
   <div><small>COMMIT</small><strong>{cert?.commitSha?.slice(0,8)||'—'}</strong><span>verified SHA</span></div>
   <div><small>SOURCE</small><strong>{cert?.source||'—'}</strong><span>certification workflow</span></div>
  </div>
  <div className="historyNote">V97 requires lint, explicit TypeScript checking, production build, migration validation, release audit, local smoke/load, ML compile, and hosted smoke evidence for the exact release before strict production certification can pass.</div>
 </section>;
}
