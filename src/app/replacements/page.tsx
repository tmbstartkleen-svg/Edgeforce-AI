'use client';

import {useEffect,useState} from 'react';

type Candidate={
  targetMarketId:string;
  targetSelection:string;
  candidateMarketId:string;
  candidateSelection:string;
  candidateSport:string;
  candidateEvent:string;
  candidateMarket:string;
  candidateOdds:number;
  candidateSimulationProbability:number;
  candidateEdge:number;
  originalTargetProbability:number;
  currentTargetProbability:number;
  currentParlayJointProbability:number|null;
  replacementParlayJointProbability:number|null;
  jointProbabilityDelta:number|null;
  replacementJointHits:number|null;
  replacementJointRuns:number|null;
  jointMode:'shared-monte-carlo'|'estimated'|'unavailable';
  correlationDelta:number|null;
  score:number;
  reasons:string[];
};

type Group={
  target:{
    marketId:string;
    selection:string;
    sport:string;
    event:string;
    market:string;
    originalSimProbability:number;
    currentSimProbability:number;
    decisionStatus:'WATCH'|'REPLACE_CANDIDATE';
    decisionScore:number;
  };
  currentParlayJointProbability:number|null;
  currentJointMode:string;
  candidates:Candidate[];
  missingCurrentLegs:string[];
};

type Payload={
  generatedAt:string;
  source:string;
  providerMode:string;
  weeklyConfigured:boolean;
  weeklyJointProbability:number|null;
  officialBoard?:boolean;
  feedIntegrity?:{status:string;reasons:string[]};
  flaggedLegs:number;
  groups:Group[];
};

const empty:Payload={generatedAt:'',source:'loading',providerMode:'loading',weeklyConfigured:false,weeklyJointProbability:null,officialBoard:false,feedIntegrity:{status:'BLOCKED',reasons:[]},flaggedLegs:0,groups:[]};
const pct=(v:number|null)=>v===null?'—':(v*100).toFixed(1)+'%';
const odds=(v:number)=>v>0?'+'+Math.round(v):String(Math.round(v));

export default function ReplacementsPage(){
  const [data,setData]=useState<Payload>(empty);
  const [error,setError]=useState('');

  useEffect(()=>{
    let mounted=true;
    const load=async()=>{
      try{
        const res=await fetch('/api/replacements',{cache:'no-store'});
        if(!res.ok)throw new Error('Replacement comparison request failed');
        const json=await res.json() as Payload;
        if(mounted){setData(json);setError('')}
      }catch(e){
        if(mounted)setError(e instanceof Error?e.message:'Replacement comparison unavailable');
      }
    };
    void load();
    const timer=window.setInterval(()=>void load(),30000);
    return ()=>{mounted=false;window.clearInterval(timer)};
  },[]);

  return <main className="v21">
    <header className="v21Top">
      <div>
        <div className="eyebrow">EDGEFORCE AI • V29</div>
        <h1>Weekly Replacement Comparison</h1>
        <p>Compares qualifying 65%+ alternatives against flagged weekly legs and recalculates the full ticket using shared Monte Carlo outcomes whenever all current legs are available.</p>
      </div>
      <div className="v21Status">
        <div><small>FLAGGED LEGS</small><b>{data.flaggedLegs}</b></div>
        <div><small>WEEK JOINT</small><b>{pct(data.weeklyJointProbability)}</b></div>
        <div><small>SOURCE</small><b>{data.providerMode.toUpperCase()}</b></div>
      </div>
    </header>

    {error&&<div className="v21Alert">{error}</div>}
    {data.officialBoard===false&&data.feedIntegrity&&<div className="v21Alert"><b>Replacement comparisons are fail-closed.</b> {data.feedIntegrity.reasons.join(' • ')} <a href="/data-health">Open data health</a></div>}

    <section className="v21Hero">
      <div>
        <div className="badge">65%+ CANDIDATES • FULL-TICKET JOINT COMPARISON • 10K SHARED OUTCOMES</div>
        <h2>Compare alternatives without <em>silently changing the ticket.</em></h2>
        <p>Each candidate shows its own simulation rate, current odds and edge plus the resulting full-parlay joint probability. Same-game and cross-market correlation are reflected by the shared simulation outcomes when available.</p>
      </div>
      <div className="v21HeroCard">
        <small>STATUS</small>
        <strong>{data.officialBoard===false?'BLOCKED':data.weeklyConfigured?'READY':'WAITING'}</strong>
        <span>{data.groups.length} flagged-leg comparison groups</span>
      </div>
    </section>

    {data.groups.map(group=><section className="v21Panel" key={group.target.marketId}>
      <div className="v21PanelHead">
        <div>
          <div className="eyebrow">{group.target.decisionStatus.replace('_',' ')}</div>
          <h3>{group.target.selection}</h3>
          <p>{group.target.sport} • {group.target.event} • {group.target.market}</p>
        </div>
        <div className="panelMeta">
          <span>Saved {pct(group.target.originalSimProbability)}</span>
          <span>Current {pct(group.target.currentSimProbability)}</span>
          <span>Current ticket {pct(group.currentParlayJointProbability)}</span>
        </div>
      </div>

      {group.missingCurrentLegs.length>0&&<div className="historyNote">Full-ticket true-joint comparison is unavailable until these current legs are present in the live simulation inventory: {group.missingCurrentLegs.join(', ')}.</div>}

      <div className="parlayCards">
        {group.candidates.map((x,i)=><div className="parlayCard" key={x.candidateMarketId}>
          <div className="parlayCardTop">
            <span>#{i+1} • {x.candidateSport}</span>
            <strong>{pct(x.replacementParlayJointProbability)}</strong>
          </div>
          <div className="parlayLegs">
            <div>
              <b>{x.candidateSelection}</b>
              <small>{x.candidateEvent} • {x.candidateMarket}</small>
              <small>Odds {odds(x.candidateOdds)} • sim {pct(x.candidateSimulationProbability)} • edge {x.candidateEdge>=0?'+':''}{pct(x.candidateEdge)}</small>
            </div>
          </div>
          <div className="parlayMeta">
            <span>Current ticket {pct(x.currentParlayJointProbability)}</span>
            <span>With candidate {pct(x.replacementParlayJointProbability)}</span>
            <span>Joint Δ {x.jointProbabilityDelta===null?'—':(x.jointProbabilityDelta>=0?'+':'')+pct(x.jointProbabilityDelta)}</span>
            <span>{x.replacementJointHits===null?'No full joint run':x.replacementJointHits.toLocaleString()+'/'+x.replacementJointRuns?.toLocaleString()+' joint hits'}</span>
            <span>Corr Δ {x.correlationDelta===null?'—':(x.correlationDelta>=0?'+':'')+pct(x.correlationDelta)}</span>
          </div>
          <div className="historyNote">{x.reasons.length?x.reasons.join(' • '):'Qualifies under the 65% simulation floor.'}</div>
        </div>)}
        {!group.candidates.length&&<div className="connectState"><b>No qualifying replacement comparisons right now.</b><p>Edgeforce will not force an alternative below the 65% leg floor.</p></div>}
      </div>
    </section>)}

    {!data.groups.length&&<section className="v21Panel"><div className="connectState"><b>No weekly legs currently need replacement comparison.</b><p>WATCH and REPLACE CANDIDATE legs will appear here automatically after re-simulation.</p></div></section>}
  </main>;
}
