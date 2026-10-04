'use client';

import {useEffect,useState} from 'react';

type Attestation={
 id?:number;modelVersion:string;serviceVersion?:string|null;provider:string;
 serviceId?:string|null;serviceName?:string|null;serviceUrl?:string|null;
 gitCommit?:string|null;gitBranch?:string|null;deploymentId?:string|null;
 deploymentStatus:string;healthOk:boolean;predictionHandshakeOk:boolean;
 activationState?:string|null;tournamentStatus?:string|null;championsActive:number;
 algorithms?:Record<string,boolean>;details?:Record<string,unknown>;error?:string|null;
 createdAt?:string;
};
type Payload={ok:boolean;build:string;schemaVersion:string;latest?:Attestation|null;rows?:Attestation[]};

const short=(v?:string|null)=>v?v.slice(0,12):'—';
const when=(v?:string|null)=>{
 if(!v)return '—';
 const d=new Date(v);
 return Number.isNaN(d.getTime())?'—':d.toLocaleString();
};

export default function MlDeploymentAutomationPanel(){
 const [data,setData]=useState<Payload|null>(null);
 const [error,setError]=useState('');

 useEffect(()=>{
  let active=true;
  const load=async()=>{
   try{
    const res=await fetch('/api/ml/deploy-attest',{cache:'no-store'});
    if(!res.ok)throw new Error('ML deployment attestation unavailable');
    const json=await res.json() as Payload;
    if(active){setData(json);setError('')}
   }catch(e){
    if(active)setError(e instanceof Error?e.message:'ML deployment attestation unavailable');
   }
  };
  void load();
  const timer=window.setInterval(()=>void load(),30000);
  return ()=>{active=false;window.clearInterval(timer)};
 },[]);

 const latest=data?.latest||null;
 const algorithms=Object.entries(latest?.algorithms||{}).filter(([,enabled])=>enabled).map(([name])=>name);

 return <section className="v21Panel">
  <div className="v21PanelHead">
   <div>
    <div className="eyebrow">V61 ML DEPLOYMENT AUTOMATION</div>
    <h3>Render deploy → commit verification → Vercel wiring → activation → durable attestation</h3>
   </div>
   <div className="panelMeta">
    <span>{latest?.deploymentStatus||'NO ATTESTATION'}</span>
    <span>{latest?.provider||'render'}</span>
    <span>{latest?.serviceVersion||'service pending'}</span>
   </div>
  </div>

  {error&&<div className="v21Alert">{error}</div>}

  <div className="v21Stats">
   <div><small>DEPLOY COMMIT</small><strong>{short(latest?.gitCommit)}</strong><span>{latest?.gitBranch||'branch not recorded'}</span></div>
   <div><small>HEALTH</small><strong>{latest?.healthOk?'PASS':'WAIT'}</strong><span>{latest?.serviceName||latest?.serviceId||'Render service not attested'}</span></div>
   <div><small>PREDICT HANDSHAKE</small><strong>{latest?.predictionHandshakeOk?'PASS':'WAIT'}</strong><span>edgeforce-ml-predict-v1</span></div>
   <div><small>ACTIVE CHAMPIONS</small><strong>{latest?.championsActive??0}</strong><span>{latest?.activationState||'not activated'}</span></div>
  </div>

  <div className="historyGrid">
   <div className="historyBox">
    <h4>Latest deployment</h4>
    <div className="historyRow"><span>Render deploy ID</span><b>{latest?.deploymentId||'—'}</b><small>workflow/API deployment identifier</small></div>
    <div className="historyRow"><span>Service URL</span><b>{latest?.serviceUrl?'VERIFIED':'—'}</b><small>{latest?.serviceUrl||'not attested yet'}</small></div>
    <div className="historyRow"><span>Tournament</span><b>{latest?.tournamentStatus||'—'}</b><small>activation state: {latest?.activationState||'—'}</small></div>
    <div className="historyRow"><span>Attested</span><b>{when(latest?.createdAt)}</b><small>{latest?.error||'no deployment error recorded'}</small></div>
   </div>
   <div className="historyBox">
    <h4>Verified algorithms</h4>
    <div className="historyRow"><span>Available</span><b>{algorithms.length}</b><small>{algorithms.join(' • ')||'awaiting deployed service health'}</small></div>
    <div className="historyRow"><span>Production rule</span><b>FAIL CLOSED</b><small>native EdgeForce models remain active if deployment or activation fails</small></div>
    <div className="historyRow"><span>Exact commit</span><b>{latest?.gitCommit?'TRACEABLE':'PENDING'}</b><small>Render exposes the running git commit through /health</small></div>
    <div className="historyRow"><span>Promotion</span><b>GATED</b><small>deployment cannot promote a model without tournament evidence</small></div>
   </div>
  </div>

  <div className="historyNote">V61 preserves the separation between infrastructure success from model success. A Render deployment may be healthy while EdgeForce remains READY_AWAITING_EVIDENCE; that is an acceptable safe state until a challenger earns promotion on holdout results.</div>
 </section>;
}
