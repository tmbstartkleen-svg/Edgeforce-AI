'use client';
import {useEffect,useState} from 'react';

type Report={
 state:'READY'|'DEGRADED'|'NOT_READY';
 ready:boolean;
 primaryCurrent:boolean;
 standbyConfigured:boolean;
 standbyLive:boolean;
 failoverReady:boolean;
 currentCommit?:string|null;
 primary:{commitSha?:string|null;deploymentUrl?:string|null;platformReady:boolean;hostedSmokePassed:boolean;exactMainCertified:boolean};
 standby:{deploymentId?:string|null;commitSha?:string|null;state?:string|null;manualOnly:boolean;commitDrift:boolean;liveHealth:{ok:boolean;httpStatus:number|null;attempts:number;error:string|null}};
 manualFailover:{ready:boolean;automaticPromotionAllowed:boolean;requiresHumanApproval:boolean;targetDeploymentId?:string|null;targetUrl?:string|null;policy:string};
 blockers:string[];
 warnings:string[];
 checkedAt:string;
};

export default function ProductionTopologyWatchdogPanel(){
 const [report,setReport]=useState<Report|null>(null);
 const [error,setError]=useState<string|null>(null);
 useEffect(()=>{
  let active=true;
  const load=async()=>{
   try{
    const r=await fetch('/api/operations/production-topology',{cache:'no-store'});
    const body=await r.json();
    if(!active)return;
    setReport(body);
    setError(null);
   }catch(e){
    if(active)setError(e instanceof Error?e.message:'topology status unavailable');
   }
  };
  void load();
  const timer=window.setInterval(()=>void load(),120000);
  return()=>{active=false;window.clearInterval(timer)};
 },[]);

 const state=report?.state||'NOT_READY';
 return <section className="v21Panel">
  <div className="v21PanelHead">
   <div><div className="eyebrow">V146 PRODUCTION TOPOLOGY WATCHDOG</div><h3>Cloudflare Primary / Vercel Standby</h3></div>
   <div className="panelMeta"><span>{error?'UNAVAILABLE':state}</span></div>
  </div>
  <div className="v21Stats">
   <div><small>PRIMARY</small><strong>{report?.primaryCurrent?'CURRENT':'—'}</strong><span>{report?.currentCommit?.slice(0,8)||'unknown'}</span></div>
   <div><small>STANDBY</small><strong>{report?.standbyLive?'HEALTHY':'—'}</strong><span>{report?.standby.state||'unknown'} / HTTP {report?.standby.liveHealth.httpStatus??'—'}</span></div>
   <div><small>FAILOVER</small><strong>{report?.failoverReady?'READY':'—'}</strong><span>{report?.standby.deploymentId||'no target'}</span></div>
   <div><small>AUTO FAILOVER</small><strong>OFF</strong><span>human approval required</span></div>
  </div>
  <div className="historyNote">
   V146 checks the active Cloudflare commit against certified production closure and probes the existing Vercel standby without deploying it.
   {report?.standby.commitDrift?' Standby commit drift is expected until an approved failover or refresh.':''}
  </div>
  {report?.blockers?.length?<div className="historyNote">Blockers: {report.blockers.join(' · ')}</div>:null}
  {report?.warnings?.length?<div className="historyNote">Notes: {report.warnings.join(' · ')}</div>:null}
  {error?<div className="historyNote">Status error: {error}</div>:null}
 </section>;
}
