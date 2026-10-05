'use client';
import {useEffect,useState} from 'react';

type Verification={
 certified:boolean;releaseVersion:string;deployedCommitSha:string;platform:string;
 workflowRunId?:string|null;createdAt:string;blockers?:string[];
};
type Payload={latest:Verification|null};

export default function PostPromotionVerificationPanel(){
 const [data,setData]=useState<Payload|null>(null);
 useEffect(()=>{let active=true;const load=async()=>{try{const r=await fetch('/api/release/post-promotion-verification',{cache:'no-store'});const j=await r.json();if(active&&r.ok)setData(j)}catch{}};void load();const t=window.setInterval(()=>void load(),120000);return()=>{active=false;window.clearInterval(t)}},[]);
 const v=data?.latest;
 return <section className="v21Panel">
  <div className="v21PanelHead"><div><div className="eyebrow">V100 POST-PROMOTION VERIFICATION</div><h3>Live Runtime Identity Certificate</h3></div><div className="panelMeta"><span>{v?.certified?'LIVE VERIFIED':'AWAITING LIVE VERIFY'}</span><span>{v?.platform||'—'}</span></div></div>
  <div className="v21Stats">
   <div><small>RELEASE</small><strong>{v?.releaseVersion||'—'}</strong><span>live runtime</span></div>
   <div><small>COMMIT</small><strong>{v?.deployedCommitSha?.slice(0,8)||'—'}</strong><span>deployed SHA</span></div>
   <div><small>WORKFLOW</small><strong>{v?.workflowRunId||'—'}</strong><span>verification run</span></div>
   <div><small>STATE</small><strong>{v?.certified?'PASS':'PENDING'}</strong><span>identity agreement</span></div>
  </div>
  <div className="historyNote">V100 verifies the live deployment only after promotion provenance is written, requiring the runtime release identity, deployed commit, execution certificate, and promotion record to agree.</div>
 </section>;
}
