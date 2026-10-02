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

type WeeklyLeg={
  marketId:string;
  sport:string;
  event:string;
  selection:string;
  market:string;
  originalOdds:number;
  originalSimProbability:number;
  currentOdds:number;
  currentSimProbability:number;
  locked:boolean;
  needsReview:boolean;
  decisionStatus:'KEEP'|'WATCH'|'REPLACE_CANDIDATE';
  decisionScore:number;
  decisionReasons:string[];
};

type ResponseBody={
  configured:boolean;
  changes:Change[];
  reviewCount:number;
  weekly:{
    configured:boolean;
    week:string;
    legs:WeeklyLeg[];
    combinedProbability:number|null;
    decisionCounts:{KEEP:number;WATCH:number;REPLACE_CANDIDATE:number};
  };
  generatedAt?:string;
};

function pct(v:number){return (v*100).toFixed(1)+'%'}
function fmtOdds(v:number){return v>0?'+'+Math.round(v):String(Math.round(v))}
function statusClass(status:WeeklyLeg['decisionStatus']){
  return status==='KEEP'?'lime':status==='WATCH'?'orange':'negative';
}

export default function PregamePage(){
  const [data,setData]=useState<ResponseBody>({
    configured:false,changes:[],reviewCount:0,
    weekly:{configured:false,week:'',legs:[],combinedProbability:null,decisionCounts:{KEEP:0,WATCH:0,REPLACE_CANDIDATE:0}}
  });
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
        <div className="eyebrow">EDGEFORCE AI • V30</div>
        <h1>Pregame Confidence Monitor</h1>
        <p>Compares each saved weekly leg with the latest 10,000-run simulation and marks it KEEP, WATCH, or REPLACE CANDIDATE from objective change rules.</p>
      </div>
      <div className="v21Status">
        <div><small>KEEP</small><b>{data.weekly.decisionCounts.KEEP}</b></div>
        <div><small>WATCH</small><b>{data.weekly.decisionCounts.WATCH}</b></div>
        <div><small>REPLACE CAND.</small><b>{data.weekly.decisionCounts.REPLACE_CANDIDATE}</b></div>
      </div>
    </header>

    {error&&<div className="v21Alert">{error}</div>}

    <section className="v21Hero">
      <div>
        <div className="badge">10K RE-SIMULATION • ORIGINAL VS CURRENT • LOCKED LEG PROTECTION</div>
        <h2>See how every weekly leg <em>changed after you saved it.</em></h2>
        <p>The status is an analytics flag, not an automatic wager instruction. Locked legs stay preserved while Edgeforce stores current odds, current simulation probability, and the reasons behind any confidence change.</p>
      </div>
      <div className="v21HeroCard">
        <small>WEEKLY JOINT</small>
        <strong>{data.weekly.combinedProbability===null?'—':pct(data.weekly.combinedProbability)}</strong>
        <span>{data.reviewCount} legs flagged for review</span>
      </div>
    </section>

    <section className="v21Panel">
      <div className="v21PanelHead">
        <div><div className="eyebrow">WEEKLY CONFIDENCE ENGINE</div><h3>Original versus current 10K simulation</h3></div>
        <div className="panelMeta"><span>{data.weekly.legs.length} saved legs</span><span>{data.weekly.week||'current week'}</span></div>
      </div>
      <div className="weeklyBuilder">
        {data.weekly.legs.map((x,i)=><div className="weeklyLeg" key={x.marketId}>
          <span className="rankCell">{i+1}</span>
          <div>
            <b>{x.selection}</b>
            <small>{x.sport} • {x.event} • {x.market}</small>
            <small>Saved {fmtOdds(x.originalOdds)} / {pct(x.originalSimProbability)} • Current {fmtOdds(x.currentOdds)} / {pct(x.currentSimProbability)}</small>
            <small className={statusClass(x.decisionStatus)}>{x.decisionReasons.join(' • ')}</small>
          </div>
          <div className="weeklyActions">
            <span className={statusClass(x.decisionStatus)}>{x.decisionStatus.replace('_',' ')}</span>
            <b>{x.decisionScore}/100</b>
            <span className={x.locked?'locked':'unlocked'}>{x.locked?'LOCKED':'OPEN'}</span>
          </div>
        </div>)}
        {!data.weekly.legs.length&&<div className="connectState"><b>No weekly legs yet.</b><p>Add 65%+ simulation legs from the main board to populate this confidence monitor.</p></div>}
      </div>
    </section>

    <section className="v21Panel">
      <div className="v21PanelHead">
        <div><div className="eyebrow">LAST 24 HOURS</div><h3>Meaningful pregame changes</h3></div>
        <div className="panelMeta"><span>{data.changes.length} detected changes</span></div>
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
        {!data.changes.length&&<div className="connectState"><b>No meaningful changes detected yet.</b><p>The monitor populates after the V30 migration and subsequent model scans.</p></div>}
      </div>
    </section>
  </main>;
}
