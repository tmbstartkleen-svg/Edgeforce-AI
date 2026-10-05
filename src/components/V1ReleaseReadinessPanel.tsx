'use client';

import {useEffect,useState} from 'react';

type Gate={id:string;label:string;state:'PASS'|'WARN'|'FAIL'|'UNKNOWN';required:boolean;detail:string};
type Payload={architectureRelease:string;verdict:'GO'|'CONDITIONAL'|'NO_GO';score:number;environment:string;strict:boolean;gates:Gate[];blockers:string[];advisories:string[];evidence:{productionCertified:boolean;operationalHealth:string;replayOrdering:string;stressPrimeReadyFragile:number|null;securityOk:boolean;liveData:boolean}};
const pct=(n:number)=>(n*100).toFixed(1)+'%';

export default function V1ReleaseReadinessPanel(){
 const [data,setData]=useState<Payload|null>(null);
 const [error,setError]=useState('');
 useEffect(()=>{
  let active=true;
  const load=async()=>{
   try{
    const res=await fetch('/api/release/v1-readiness',{cache:'no-store'});
    const json=await res.json() as Payload;
    if(active){setData(json);setError(res.ok?'':'v1 readiness has release blockers')}
   }catch(e){if(active)setError(e instanceof Error?e.message:'v1 readiness unavailable')}
  };
  void load();
  const timer=window.setInterval(()=>void load(),180000);
  return()=>{active=false;window.clearInterval(timer)};
 },[]);

 return <section className="v21Panel">
  <div className="v21PanelHead">
   <div><div className="eyebrow">V123 FINAL RELEASE CERTIFICATION</div><h3>EdgeForce v1 Readiness</h3></div>
   <div className="panelMeta"><span>{data?.verdict||'LOADING'}</span><span>Score {data?pct(data.score):'—'}</span></div>
  </div>
  {error&&<div className="v21Alert">{error}</div>}
  <div className="v21Stats">
   <div><small>PRODUCTION CERT</small><strong>{data?.evidence.productionCertified?'PASS':'—'}</strong><span>base certification</span></div>
   <div><small>OPS HEALTH</small><strong>{data?.evidence.operationalHealth||'—'}</strong><span>V122 health gate</span></div>
   <div><small>REPLAY ORDERING</small><strong>{data?.evidence.replayOrdering||'—'}</strong><span>historical hierarchy</span></div>
   <div><small>LIVE DATA</small><strong>{data?.evidence.liveData?'LIVE':'—'}</strong><span>strict production requires live</span></div>
  </div>
  <div className="historyGrid">
   <div className="historyBox"><h4>Release gates</h4>
    {(data?.gates||[]).map(x=><div className="historyRow" key={x.id}>
     <span>{x.label}</span><b>{x.state}{x.required?' · REQUIRED':''}</b>
     <small>{x.detail}</small>
    </div>)}
   </div>
   <div className="historyBox"><h4>Verdict policy</h4>
    <div className="historyRow"><span>GO</span><b>ALL CLEAR</b><small>All required gates pass and no known decision-ordering regression exists.</small></div>
    <div className="historyRow"><span>CONDITIONAL</span><b>NO HARD BLOCKER</b><small>Evidence is incomplete or warning-level, but there is no known release-blocking regression.</small></div>
    <div className="historyRow"><span>NO_GO</span><b>FAIL-CLOSED</b><small>A required production gate failed or historical decision ordering is misordered.</small></div>
    <div className="historyRow"><span>Accuracy / profit guarantee</span><b>NONE</b><small>Release readiness certifies software controls and evidence state, not future sports or market outcomes.</small></div>
   </div>
  </div>
  {Boolean(data?.blockers?.length)&&<div className="historyNote">Blockers: {data?.blockers.slice(0,5).join(' • ')}</div>}
  {!data?.blockers?.length&&Boolean(data?.advisories?.length)&&<div className="historyNote">Advisories: {data?.advisories.slice(0,5).join(' • ')}</div>}
 </section>;
}