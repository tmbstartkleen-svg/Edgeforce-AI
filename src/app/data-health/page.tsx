'use client';

import {useEffect,useState} from 'react';

type ProviderRow={
  id:string;
  name:string;
  capability:string;
  priority:number;
  enabled:boolean;
  configured:boolean;
  lastSuccessAt:string|null;
  lastFailureAt:string|null;
  latencyMs:number|null;
  errorRate:number|null;
  healthScore:number|null;
  status:'HEALTHY'|'DEGRADED'|'UNHEALTHY'|'UNKNOWN';
  stale:boolean;
};

type IntegrityRow={
  status:'TRUSTED'|'DEGRADED'|'BLOCKED';
  officialEligible:boolean;
  source:string;
  mode:string;
  totalMarkets:number;
  acceptedMarkets:number;
  rejectedMarkets:number;
  rejectedStale:number;
  rejectedInvalid:number;
  rejectedConflicts:number;
  maxSourceAgeMin:number;
  conflictRate:number;
  validationCompared:number;
  validationConflicts:number;
  reconciliationCoverage:number;
  reasons:string[];
  createdAt:string;
};

type Payload={
  ok:boolean;
  providers:{
    databaseConfigured:boolean;
    rows:ProviderRow[];
    counts:{configured:number;healthy:number;degraded:number;unhealthy:number;unknown:number};
    generatedAt:string;
  };
  integrityHistory:IntegrityRow[];
  generatedAt:string;
};

const empty:Payload={
  ok:true,
  providers:{databaseConfigured:false,rows:[],counts:{configured:0,healthy:0,degraded:0,unhealthy:0,unknown:0},generatedAt:''},
  integrityHistory:[],
  generatedAt:''
};

function pct(v:number|null){return v===null?'—':(v*100).toFixed(1)+'%'}
function age(v:string|null){
  if(!v)return 'never';
  const t=new Date(v).getTime();
  if(!Number.isFinite(t))return 'unknown';
  const min=Math.max(0,Math.round((Date.now()-t)/60000));
  return min<60?min+'m ago':Math.round(min/60)+'h ago';
}
function statusClass(status:string){
  return status==='HEALTHY'||status==='TRUSTED'?'lime':status==='DEGRADED'?'orange':'negative';
}

export default function DataHealthPage(){
  const [data,setData]=useState<Payload>(empty);
  const [error,setError]=useState('');

  useEffect(()=>{
    let mounted=true;
    const load=async()=>{
      try{
        const res=await fetch('/api/provider-health',{cache:'no-store'});
        if(!res.ok)throw new Error('Provider health request failed');
        const json=await res.json() as Payload;
        if(mounted){setData(json);setError('')}
      }catch(e){
        if(mounted)setError(e instanceof Error?e.message:'Provider health unavailable');
      }
    };
    void load();
    const timer=window.setInterval(()=>void load(),30000);
    return ()=>{mounted=false;window.clearInterval(timer)};
  },[]);

  const latest=data.integrityHistory[0];

  return <main className="v21">
    <header className="v21Top">
      <div>
        <div className="eyebrow">EDGEFORCE AI • V28</div>
        <h1>Production Data Health</h1>
        <p>Shows provider health, feed freshness, reconciliation coverage, rejected markets and whether the official betting board is allowed to publish.</p>
      </div>
      <div className="v21Status">
        <div><small>OFFICIAL BOARD</small><b className={latest?.officialEligible?'lime':'negative'}>{latest?.officialEligible?'OPEN':'BLOCKED'}</b></div>
        <div><small>PROVIDERS</small><b>{data.providers.counts.configured}</b></div>
        <div><small>FRESH HEALTHY</small><b>{data.providers.counts.healthy}</b></div>
      </div>
    </header>

    {error&&<div className="v21Alert">{error}</div>}

    <section className="v21Hero">
      <div>
        <div className="badge">FAIL CLOSED • STALE-LINE REJECTION • CROSS-PROVIDER RECONCILIATION</div>
        <h2>Edgeforce only publishes official picks when the <em>live feed passes production checks.</em></h2>
        <p>Stored snapshots and demo data can still exist for diagnostics, but V28 prevents them from appearing as official Daily Top 30 or weekly parlay recommendations.</p>
      </div>
      <div className="v21HeroCard">
        <small>LATEST INTEGRITY</small>
        <strong className={statusClass(latest?.status||'BLOCKED')}>{latest?.status||'WAITING'}</strong>
        <span>{latest?latest.acceptedMarkets+' accepted / '+latest.totalMarkets+' input markets':'No audit snapshot yet'}</span>
      </div>
    </section>

    <section className="v21Panel">
      <div className="v21PanelHead">
        <div><div className="eyebrow">PROVIDER HEALTH</div><h3>Configured production data sources</h3></div>
        <div className="panelMeta"><span>{data.providers.counts.healthy} healthy</span><span>{data.providers.counts.degraded} degraded/stale</span><span>{data.providers.counts.unhealthy} unhealthy</span></div>
      </div>
      <div className="weeklyBuilder">
        {data.providers.rows.map(row=><div className="weeklyLeg" key={row.id}>
          <div>
            <b>{row.name}</b>
            <small>{row.capability} • priority {row.priority}</small>
            <small>Last success {age(row.lastSuccessAt)} • latency {row.latencyMs===null?'—':Math.round(row.latencyMs)+'ms'} • error rate {pct(row.errorRate)}</small>
          </div>
          <div className="weeklyActions">
            <span className={statusClass(row.stale?'DEGRADED':row.status)}>{row.stale&&row.status!=='UNHEALTHY'?'STALE':row.status}</span>
            <b>{row.healthScore===null?'—':pct(row.healthScore)}</b>
          </div>
        </div>)}
        {!data.providers.rows.length&&<div className="connectState"><b>No production providers configured.</b><p>Configure the odds, weather, injury, stats, results, and prediction feeds before final production release.</p></div>}
      </div>
    </section>

    <section className="v21Panel">
      <div className="v21PanelHead">
        <div><div className="eyebrow">FEED INTEGRITY HISTORY</div><h3>Recent official-board gates</h3></div>
      </div>
      <div className="signalList">
        {data.integrityHistory.map((x,i)=><div key={x.createdAt+'-'+i}>
          <span className={statusClass(x.status)}>{x.status}</span>
          <div>
            <b>{x.source.toUpperCase()} • {x.acceptedMarkets}/{x.totalMarkets} accepted</b>
            <small>{new Date(x.createdAt).toLocaleString()} • max age {x.maxSourceAgeMin.toFixed(1)}m • reconciliation {pct(x.reconciliationCoverage)} • conflicts {pct(x.conflictRate)}</small>
            <p>{x.reasons.join(' • ')}</p>
            <small>Rejected: {x.rejectedStale} stale • {x.rejectedInvalid} invalid • {x.rejectedConflicts} provider conflicts</small>
          </div>
        </div>)}
        {!data.integrityHistory.length&&<div className="connectState"><b>No feed-integrity snapshots yet.</b><p>The scheduled scan records them after V28 migration is applied.</p></div>}
      </div>
    </section>
  </main>;
}
