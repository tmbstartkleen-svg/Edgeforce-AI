'use client';

import {useEffect,useState} from 'react';

type Readiness={
  version:string;
  environment:string;
  gitSha:string|null;
  readyForPreview:boolean;
  readyForProduction:boolean;
  blockers:string[];
  warnings:string[];
  checks:Record<string,boolean|number|string|null>;
};

const empty:Readiness={
  version:'30.0.0',environment:'loading',gitSha:null,readyForPreview:false,readyForProduction:false,blockers:[],warnings:[],checks:{}
};

function label(k:string){
  return k.replace(/([A-Z])/g,' $1').replace(/^./,x=>x.toUpperCase());
}

export default function ReleasePage(){
  const [data,setData]=useState<Readiness>(empty);
  const [error,setError]=useState('');

  useEffect(()=>{
    let mounted=true;
    const load=async()=>{
      try{
        const res=await fetch('/api/release-readiness',{cache:'no-store'});
        if(!res.ok)throw new Error('Release readiness request failed');
        const json=await res.json() as Readiness;
        if(mounted){setData(json);setError('')}
      }catch(e){
        if(mounted)setError(e instanceof Error?e.message:'Release readiness unavailable');
      }
    };
    void load();
    const timer=window.setInterval(()=>void load(),30000);
    return ()=>{mounted=false;window.clearInterval(timer)};
  },[]);

  return <main className="v21">
    <header className="v21Top">
      <div>
        <div className="eyebrow">EDGEFORCE AI • V30</div>
        <h1>Release Readiness</h1>
        <p>Checks the database migration level, environment configuration, provider readiness and production feed gate before a Vercel preview or production promotion is allowed.</p>
      </div>
      <div className="v21Status">
        <div><small>PREVIEW</small><b className={data.readyForPreview?'lime':'negative'}>{data.readyForPreview?'READY':'BLOCKED'}</b></div>
        <div><small>PRODUCTION</small><b className={data.readyForProduction?'lime':'negative'}>{data.readyForProduction?'READY':'BLOCKED'}</b></div>
        <div><small>VERSION</small><b>{data.version}</b></div>
      </div>
    </header>

    {error&&<div className="v21Alert">{error}</div>}

    <section className="v21Hero">
      <div>
        <div className="badge">NO AUTO DEPLOY • STATIC RELEASE GATE • MIGRATION GATE • LIVE FEED GATE</div>
        <h2>One deliberate deployment after the <em>entire release gate passes.</em></h2>
        <p>The development branch stays disconnected from automatic Vercel deploys. GitHub Actions can keep building and testing without consuming Vercel deployment capacity.</p>
      </div>
      <div className="v21HeroCard">
        <small>ENVIRONMENT</small>
        <strong>{data.environment.toUpperCase()}</strong>
        <span>{data.gitSha?data.gitSha.slice(0,12):'no hosted git sha'}</span>
      </div>
    </section>

    <section className="v21Panel">
      <div className="v21PanelHead">
        <div><div className="eyebrow">BLOCKERS</div><h3>Must pass before preview deployment</h3></div>
        <div className="panelMeta"><span>{data.blockers.length} blockers</span></div>
      </div>
      <div className="signalList">
        {data.blockers.map((x,i)=><div key={i}><span className="negative">BLOCK</span><div><b>{x}</b></div></div>)}
        {!data.blockers.length&&<div className="connectState"><b>No preview blockers.</b><p>The environment and migration prerequisites pass.</p></div>}
      </div>
    </section>

    <section className="v21Panel">
      <div className="v21PanelHead">
        <div><div className="eyebrow">WARNINGS</div><h3>Production conditions to verify</h3></div>
        <div className="panelMeta"><span>{data.warnings.length} warnings</span></div>
      </div>
      <div className="signalList">
        {data.warnings.map((x,i)=><div key={i}><span className="orange">WATCH</span><div><b>{x}</b></div></div>)}
        {!data.warnings.length&&<div className="connectState"><b>No production warnings.</b><p>Live provider and feed-integrity checks are healthy.</p></div>}
      </div>
    </section>

    <section className="v21Panel">
      <div className="v21PanelHead">
        <div><div className="eyebrow">CHECK MATRIX</div><h3>Release prerequisites</h3></div>
      </div>
      <div className="weeklyBuilder">
        {Object.entries(data.checks).map(([k,v])=><div className="weeklyLeg noRank" key={k}>
          <div><b>{label(k)}</b><small>{typeof v==='boolean'?(v?'pass':'not ready'):String(v??'—')}</small></div>
          <div className="weeklyActions"><span className={typeof v==='boolean'?(v?'lime':'negative'):'unlocked'}>{typeof v==='boolean'?(v?'PASS':'BLOCK'):'INFO'}</span></div>
        </div>)}
      </div>
    </section>
  </main>;
}
