'use client';

import {useEffect,useState} from 'react';

type Change={
  id:string;
  eventId:string;
  marketId:string;
  marketKey:string;
  selection:string;
  sport:string;
  severity:'HIGH'|'MEDIUM';
  reasons:string[];
  previousSimulationProbability:number;
  currentSimulationProbability:number;
  detectedAt:string;
};

type ResponseBody={
  configured:boolean;
  changes:Change[];
  reviewCount:number;
  generatedAt?:string;
};

function pct(v:number){return (v*100).toFixed(1)+'%'}

export default function PregamePage(){
  const [data,setData]=useState<ResponseBody>({configured:false,changes:[],reviewCount:0});
  const [error,setError]=useState('');

  useEffect(()=>{
    let mounted=true;
    const load=async()=>{
      try{
        const res=await fetch('/api/pregame',{cache:'no-store'});
        if(!res.ok)throw new Error('Pregame feed request failed');
        const json=await res.json() as ResponseBody;
        if(mounted){setData(json);setError('')}
      }catch(e){
        if(mounted)setError(e instanceof Error?e.message:'Pregame feed unavailable');
      }
    };
    void load();
    const timer=window.setInterval(()=>void load(),30000);
    return ()=>{mounted=false;window.clearInterval(timer)};
  },[]);

  return <main className="v21">
    <header className="v21Top">
      <div>
        <div className="eyebrow">EDGEFORCE AI • V25</div>
        <h1>Pregame Re-Simulation Monitor</h1>
        <p>Tracks meaningful changes in simulations, lines, injuries, starters, confirmed lineups, weather and player projections.</p>
      </div>
      <div className="v21Status">
        <div><small>CHANGES</small><b>{data.changes.length}</b></div>
        <div><small>WEEKLY REVIEW</small><b>{data.reviewCount}</b></div>
        <div><small>REFRESH</small><b>30 sec</b></div>
      </div>
    </header>

    {error&&<div className="v21Alert">{error}</div>}

    <section className="v21Hero">
      <div>
        <div className="badge">AUTOMATIC CHANGE DETECTION • 10K RE-SIMULATION • LOCKED LEG PROTECTION</div>
        <h2>See exactly <em>what changed before game time.</em></h2>
        <p>Locked weekly legs preserve the original saved line and simulation. Edgeforce stores the new live values separately and flags the leg for review instead of silently replacing it.</p>
      </div>
      <div className="v21HeroCard">
        <small>STATUS</small>
        <strong>{data.configured?'ACTIVE':'WAITING'}</strong>
        <span>{data.configured?'database-backed monitor':'database migration required'}</span>
      </div>
    </section>

    <section className="v21Panel">
      <div className="v21PanelHead">
        <div><div className="eyebrow">LAST 24 HOURS</div><h3>Meaningful pregame changes</h3></div>
        <div className="panelMeta"><span>{data.reviewCount} weekly legs need review</span></div>
      </div>

      <div className="signalList">
        {data.changes.map(x=><div key={x.id}>
          <span className={'signal '+x.severity.toLowerCase()}>{x.severity}</span>
          <div>
            <b>{x.selection}</b>
            <small>{x.sport} • {x.marketKey}</small>
            <p>{x.reasons.join(' • ')}</p>
            <small>{pct(x.previousSimulationProbability)} → {pct(x.currentSimulationProbability)} • {new Date(x.detectedAt).toLocaleString()}</small>
          </div>
        </div>)}
        {!data.changes.length&&<div className="connectState"><b>No meaningful changes detected yet.</b><p>The monitor will populate after V25 migration and subsequent scheduled scans.</p></div>}
      </div>
    </section>
  </main>;
}
