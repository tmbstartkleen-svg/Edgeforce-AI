'use client';

import {useEffect,useState} from 'react';

type Event={id:number;stage:string;deploymentUrl:string|null;commitSha:string|null;createdAt:string};
type Payload={configured:boolean;state:'NOT_STARTED'|'IN_PROGRESS'|'READY'|'FAILED'|'ROLLED_BACK'|'STALE';launchId:string|null;progress:number;events:Event[];missingStages:string[];ageMinutes?:number|null};
const pct=(n:number)=>(n*100).toFixed(0)+'%';

export default function ProductionLaunchPanel(){
 const [data,setData]=useState<Payload|null>(null);
 const [error,setError]=useState('');
 useEffect(()=>{let active=true;const load=async()=>{try{const res=await fetch('/api/release/launch-status',{cache:'no-store'});const json=await res.json() as Payload;if(active){setData(json);setError(res.ok?'':'launch status unavailable')}}catch(e){if(active)setError(e instanceof Error?e.message:'launch status unavailable')}};void load();const timer=window.setInterval(()=>void load(),60000);return()=>{active=false;window.clearInterval(timer)}},[]);
 return <section className="v21Panel">
  <div className="v21PanelHead"><div><div className="eyebrow">V124 PRODUCTION LAUNCH</div><h3>Launch Controller & Deployment Evidence</h3></div><div className="panelMeta"><span>{data?.state||'LOADING'}</span><span>{data?pct(data.progress):'—'} complete</span></div></div>
  {error&&<div className="v21Alert">{error}</div>}
  <div className="v21Stats">
   <div><small>LAUNCH ID</small><strong>{data?.launchId?data.launchId.slice(0,16):'—'}</strong><span>current release attempt</span></div>
   <div><small>STAGES</small><strong>{data?.events?.length||0}</strong><span>durable launch events</span></div>
   <div><small>MISSING</small><strong>{data?.missingStages?.length||0}</strong><span>required stages remaining</span></div>
   <div><small>AGE</small><strong>{data?.ageMinutes===null||data?.ageMinutes===undefined?'—':Math.round(data.ageMinutes)+'m'}</strong><span>since latest event</span></div>
  </div>
  <div className="historyGrid">
   <div className="historyBox"><h4>Launch timeline</h4>
    {(data?.events||[]).slice(-12).reverse().map(x=><div className="historyRow" key={x.id}>
     <span>{x.stage}</span><b>{new Date(x.createdAt).toLocaleTimeString()}</b>
     <small>{x.commitSha?x.commitSha.slice(0,12):'no commit'}{x.deploymentUrl?' • '+x.deploymentUrl:''}</small>
    </div>)}
    {!data?.events?.length&&<div className="historyRow"><span>No production launch recorded</span><b>NOT STARTED</b><small>The next production workflow will populate this ledger.</small></div>}
   </div>
   <div className="historyBox"><h4>Required sequence</h4>
    {['DEPLOYED','MIGRATED','PROVIDERS_CERTIFIED','LAUNCH_DOCTOR_PASSED','SMOKE_PASSED','ATTESTED','STRICT_CERTIFIED','V1_READY','COMPLETE'].map(stage=><div className="historyRow" key={stage}>
     <span>{stage}</span><b>{data?.missingStages?.includes(stage)?'PENDING':'RECORDED'}</b>
    </div>)}
   </div>
  </div>
  <div className="historyNote">V124 records production launch evidence and requires V123 strict readiness before COMPLETE. Failed hosted checks trigger the existing Vercel rollback path.</div>
 </section>;
}