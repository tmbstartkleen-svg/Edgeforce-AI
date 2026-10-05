'use client';

import {useEffect,useState} from 'react';

type Check={id:string;label:string;state:'HEALTHY'|'DEGRADED'|'CRITICAL'|'UNKNOWN';value:number|null;unit:string;threshold:string;reason:string};
type Payload={overall:'HEALTHY'|'DEGRADED'|'CRITICAL'|'UNKNOWN';score:number;summary:{healthy:number;degraded:number;critical:number;unknown:number;total:number};checks:Check[];incidents:{action:number;watch:number;total:number};database:{configured:boolean;latencyMs:number|null;error:string|null};freshness:{latestMarketAgeMin:number|null;latestConsensusAgeMin:number|null;latestModelRunAgeMin:number|null;latestAutomationAgeMin:number|null}};
const pct=(n:number)=>(n*100).toFixed(1)+'%';

export default function ProductionObservabilityPanel(){
 const [data,setData]=useState<Payload|null>(null);
 const [error,setError]=useState('');
 useEffect(()=>{
  let active=true;
  const load=async()=>{
   try{
    const res=await fetch('/api/operations/observability',{cache:'no-store'});
    const json=await res.json() as Payload;
    if(active){setData(json);setError(res.ok?'':json.overall==='CRITICAL'?'Production health is CRITICAL':'observability unavailable')}
   }catch(e){if(active)setError(e instanceof Error?e.message:'observability unavailable')}
  };
  void load();
  const timer=window.setInterval(()=>void load(),60000);
  return()=>{active=false;window.clearInterval(timer)};
 },[]);
 return <section className="v21Panel">
  <div className="v21PanelHead">
   <div><div className="eyebrow">V122 PRODUCTION OBSERVABILITY</div><h3>Health, Freshness, Automation & Incident SLA Monitor</h3></div>
   <div className="panelMeta"><span>{data?.overall||'LOADING'}</span><span>Health {data?pct(data.score):'—'}</span></div>
  </div>
  {error&&<div className="v21Alert">{error}</div>}
  <div className="v21Stats">
   <div><small>HEALTHY CHECKS</small><strong>{data?.summary.healthy||0}</strong><span>{data?.summary.total||0} total</span></div>
   <div><small>DEGRADED / UNKNOWN</small><strong>{(data?.summary.degraded||0)+(data?.summary.unknown||0)}</strong><span>requires review</span></div>
   <div><small>CRITICAL</small><strong>{data?.summary.critical||0}</strong><span>fail-closed conditions</span></div>
   <div><small>ACTION INCIDENTS</small><strong>{data?.incidents.action||0}</strong><span>{data?.incidents.watch||0} watch incidents</span></div>
  </div>
  <div className="historyGrid">
   <div className="historyBox"><h4>Operational checks</h4>
    {(data?.checks||[]).map(x=><div className="historyRow" key={x.id}>
     <span>{x.label}</span><b>{x.state}</b>
     <small>{x.value===null?'—':x.value+' '+x.unit} • {x.threshold}</small>
     <small>{x.reason}</small>
    </div>)}
   </div>
   <div className="historyBox"><h4>Freshness & latency</h4>
    <div className="historyRow"><span>Database latency</span><b>{data?.database.latencyMs===null||data?.database.latencyMs===undefined?'—':data.database.latencyMs+' ms'}</b><small>{data?.database.configured?'database configured':'database not configured'}</small></div>
    <div className="historyRow"><span>Raw market age</span><b>{data?.freshness.latestMarketAgeMin===null||data?.freshness.latestMarketAgeMin===undefined?'—':Math.round(data.freshness.latestMarketAgeMin)+'m'}</b><small>healthy target ≤15m</small></div>
    <div className="historyRow"><span>Consensus age</span><b>{data?.freshness.latestConsensusAgeMin===null||data?.freshness.latestConsensusAgeMin===undefined?'—':Math.round(data.freshness.latestConsensusAgeMin)+'m'}</b><small>healthy target ≤15m</small></div>
    <div className="historyRow"><span>Model-run age</span><b>{data?.freshness.latestModelRunAgeMin===null||data?.freshness.latestModelRunAgeMin===undefined?'—':Math.round(data.freshness.latestModelRunAgeMin)+'m'}</b><small>healthy target ≤60m</small></div>
    <div className="historyRow"><span>Automation-run age</span><b>{data?.freshness.latestAutomationAgeMin===null||data?.freshness.latestAutomationAgeMin===undefined?'—':Math.round(data.freshness.latestAutomationAgeMin)+'m'}</b><small>healthy target ≤180m</small></div>
   </div>
  </div>
  <div className="historyNote">V122 treats stale feeds, failed automation, database failures, and unresolved ACTION incidents as production-health risks. Health monitoring does not execute wagers or trades.</div>
 </section>;
}