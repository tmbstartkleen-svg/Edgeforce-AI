'use client';

import {useEffect,useState} from 'react';

type Payload={
 ok:boolean;
 build:string;
 schemaVersion:string;
 readiness:{state:'UNCONFIGURED'|'UNHEALTHY'|'READY'|'READY_AWAITING_EVIDENCE'|'ACTIVE';active:boolean;reason:string};
 latestActivation?:{
  id:number;status:string;serviceVersion?:string|null;healthOk:boolean;predictionHandshakeOk:boolean;
  tournamentOk:boolean;candidatesEvaluated:number;championsPromoted:number;championsActive:number;
  startedAt:string;completedAt?:string|null;error?:string|null;
 }|null;
 health:{
  latest?:{
   ok:boolean;configured:boolean;serviceVersion?:string|null;latencyMs?:number|null;
   predictionReady:boolean;trainingReady:boolean;failureCount:number;circuitOpenUntil?:string|null;
   error?:string|null;checkedAt:string;algorithms?:Record<string,boolean>;
  }|null;
  circuit?:{
   configured:boolean;open:boolean;failures:number;openUntil?:string|null;
   lastSuccess?:string|null;lastFailure?:string|null;lastError?:string|null;
   serviceVersion?:string|null;algorithms?:Record<string,boolean>;
  };
 };
 tournament:{
  latestRun?:{
   status:string;serviceVersion?:string|null;rowsExported:number;groupsRequested:number;
   candidatesEvaluated:number;championsPromoted:number;challengersRetained:number;
   startedAt:string;completedAt?:string|null;
  }|null;
  summary?:{champions:number;sports:number;candidates:number};
 };
 deployment:{
  renderBlueprint:boolean;persistentModelStoreRequired:boolean;
  expectedHealthPath:string;expectedPredictionPath:string;expectedTrainingPath:string;expectedPromotionPath:string;
 };
};

const when=(v?:string|null)=>{
 if(!v)return '—';
 const d=new Date(v);
 return Number.isNaN(d.getTime())?'—':d.toLocaleString();
};

export default function MlServiceActivationPanel(){
 const [data,setData]=useState<Payload|null>(null);
 const [error,setError]=useState('');

 useEffect(()=>{
  let active=true;
  const load=async()=>{
   try{
    const res=await fetch('/api/intelligence/ml-service',{cache:'no-store'});
    if(!res.ok)throw new Error('ML service status unavailable');
    const json=await res.json() as Payload;
    if(active){setData(json);setError('')}
   }catch(e){
    if(active)setError(e instanceof Error?e.message:'ML service status unavailable');
   }
  };
  void load();
  const timer=window.setInterval(()=>void load(),30000);
  return ()=>{active=false;window.clearInterval(timer)};
 },[]);

 const state=data?.readiness.state||'UNCONFIGURED';
 const latest=data?.health.latest;
 const circuit=data?.health.circuit;
 const tournament=data?.tournament.latestRun;
 const algorithms=Object.entries(latest?.algorithms||circuit?.algorithms||{}).sort((a,b)=>a[0].localeCompare(b[0]));

 return <section className="v21Panel">
  <div className="v21PanelHead">
   <div>
    <div className="eyebrow">V56 ML SERVICE ACTIVATION</div>
    <h3>Deployment, health, tournament readiness, and live champion activation</h3>
   </div>
   <div className="panelMeta">
    <span>{state}</span>
    <span>{data?.tournament.summary?.champions??0} champions</span>
    <span>{latest?.serviceVersion||circuit?.serviceVersion||'service not verified'}</span>
   </div>
  </div>

  {error&&<div className="v21Alert">{error}</div>}

  <div className="v21Stats">
   <div><small>SERVICE HEALTH</small><strong>{latest?.ok?'HEALTHY':state==='UNCONFIGURED'?'NOT WIRED':'DEGRADED'}</strong><span>{latest?.latencyMs!=null?latest.latencyMs+' ms':'no verified probe'}</span></div>
   <div><small>PREDICTION CONTRACT</small><strong>{data?.latestActivation?.predictionHandshakeOk?'VERIFIED':'PENDING'}</strong><span>/predict schema handshake</span></div>
   <div><small>TOURNAMENT</small><strong>{tournament?.status?.toUpperCase()||'NOT RUN'}</strong><span>{tournament?.candidatesEvaluated??0} candidates evaluated</span></div>
   <div><small>PRODUCTION STATE</small><strong>{data?.readiness.active?'ACTIVE':'SAFE FALLBACK'}</strong><span>{data?.readiness.reason||'—'}</span></div>
  </div>

  <div className="historyGrid">
   <div className="historyBox">
    <h4>Service circuit</h4>
    <div className="historyRow"><span>Configured</span><b>{circuit?.configured?'YES':'NO'}</b><small>health + prediction + training endpoints must all be present</small></div>
    <div className="historyRow"><span>Circuit</span><b>{circuit?.open?'OPEN':'CLOSED'}</b><small>{circuit?.openUntil?'until '+when(circuit.openUntil):'native models remain available regardless'}</small></div>
    <div className="historyRow"><span>Failures</span><b>{circuit?.failures??0}</b><small>{circuit?.lastError||'no recent ML service failure'}</small></div>
    <div className="historyRow"><span>Last success</span><b>{when(circuit?.lastSuccess)}</b><small>last verified service response</small></div>
   </div>

   <div className="historyBox">
    <h4>Activation gates</h4>
    <div className="historyRow"><span>Health check</span><b>{data?.latestActivation?.healthOk?'PASS':'WAIT'}</b><small>{data?.deployment.expectedHealthPath||'/health'}</small></div>
    <div className="historyRow"><span>Prediction handshake</span><b>{data?.latestActivation?.predictionHandshakeOk?'PASS':'WAIT'}</b><small>{data?.deployment.expectedPredictionPath||'/predict'}</small></div>
    <div className="historyRow"><span>Tournament validation</span><b>{data?.latestActivation?.tournamentOk?'PASS':'WAIT'}</b><small>{data?.latestActivation?.candidatesEvaluated??0} candidates in latest activation</small></div>
    <div className="historyRow"><span>Promoted champions</span><b>{data?.latestActivation?.championsActive??data?.tournament.summary?.champions??0}</b><small>at least one champion is required for ACTIVE state</small></div>
   </div>
  </div>

  <div className="v21PanelHead">
   <div><div className="eyebrow">HEAVYWEIGHT ALGORITHMS</div><h3>Verified service availability</h3></div>
  </div>
  <div className="historyGrid">
   {algorithms.length?algorithms.map(([name,available])=><div className="historyBox" key={name}>
    <h4>{name}</h4>
    <div className="historyRow"><span>Runtime</span><b>{available?'AVAILABLE':'UNAVAILABLE'}</b><small>reported by the deployed Python service health endpoint</small></div>
   </div>):<div className="historyBox"><h4>No verified service yet</h4><div className="historyRow"><span>Algorithms</span><b>PENDING</b><small>EdgeForce will not label external algorithms live until /health reports them.</small></div></div>}
  </div>

  <div className="historyNote">The V56 activation state is intentionally conservative. Deploying the container does not activate its predictions by itself. EdgeForce stays on native models until health, contract, tournament and champion gates all pass.</div>
 </section>;
}
