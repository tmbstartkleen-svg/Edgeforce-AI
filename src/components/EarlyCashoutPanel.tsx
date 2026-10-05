'use client';

import {useEffect,useState} from 'react';

type Leg={
 id:string;order:number;sport:string;event:string;selection:string;market:string;startTime:string;
 odds:number;simProbability:number;dynamicConfidence:number;expectedValue:number;grade:string;finalRiskLeg:boolean;
};
type Checkpoint={
 afterLeg:number;label:string;remainingLegs:number;remainingModelProbability:number;
 theoreticalHoldMultiple:number;instruction:string;
};
type Payload={
 ok:boolean;
 ladder:{
  legCount:number;legs:Leg[];combinedAmericanOdds:number;independentProbability:number;
  finalRiskLeg:Leg|null;checkpointPlan:Checkpoint[];notes:string[];
 };
 warnings:string[];
};

const pct=(n:number)=>(n*100).toFixed(1)+'%';
const odds=(n:number)=>n>0?'+'+n:String(n);
const time=(v:string)=>new Date(v).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'});

export default function EarlyCashoutPanel(){
 const [data,setData]=useState<Payload|null>(null);
 const [error,setError]=useState('');

 useEffect(()=>{
  let active=true;
  const load=async()=>{
   try{
    const res=await fetch('/api/early-cashout?limit=20',{cache:'no-store'});
    if(!res.ok)throw new Error('early cash-out ladder unavailable');
    const json=await res.json() as Payload;
    if(active){setData(json);setError('')}
   }catch(e){if(active)setError(e instanceof Error?e.message:'early cash-out ladder unavailable')}
  };
  void load();
  const timer=window.setInterval(()=>void load(),60000);
  return ()=>{active=false;window.clearInterval(timer)};
 },[]);

 const ladder=data?.ladder;
 return <section className="v21Panel">
  <div className="v21PanelHead">
   <div>
    <div className="eyebrow">CASH OUT EARLY · MORNING-TO-NIGHT LADDER</div>
    <h3>Up to 20 qualified legs with the longest-odds risk saved for last</h3>
   </div>
   <div className="panelMeta">
    <span>{ladder?.legCount??0} legs</span>
    <span>{ladder?.combinedAmericanOdds?odds(ladder.combinedAmericanOdds):'—'} combined</span>
    <span>analytics only</span>
   </div>
  </div>

  {error&&<div className="v21Alert">{error}</div>}
  {data?.warnings?.[0]&&<div className="historyNote">{data.warnings[0]}</div>}

  <div className="historyGrid">
   <div className="historyBox">
    <h4>Early Cash-Out Ladder</h4>
    {(ladder?.legs||[]).map(x=><div className="historyRow" key={x.id}>
     <span>#{x.order} · {time(x.startTime)} · {x.selection}</span>
     <b>{odds(x.odds)}{x.finalRiskLeg?' · FINAL':''}</b>
     <small>{x.sport} • {x.event}</small>
     <small>sim {pct(x.simProbability)} • confidence {pct(x.dynamicConfidence)} • EV {x.expectedValue>=0?'+':''}{pct(x.expectedValue)} • {x.grade}</small>
    </div>)}
    {!ladder?.legs?.length&&<div className="historyRow"><span>No qualifying ladder today</span><b>HOLD</b><small>Edgeforce requires positive EV, non-stale pricing, sufficient confidence and distinct events.</small></div>}
   </div>

   <div className="historyBox">
    <h4>Cash-out review points</h4>
    {(ladder?.checkpointPlan||[]).map(x=><div className="historyRow" key={x.afterLeg}>
     <span>{x.label}</span><b>{x.remainingLegs} left</b>
     <small>remaining modeled hit rate {pct(x.remainingModelProbability)} • theoretical hold multiple {x.theoreticalHoldMultiple.toFixed(2)}×</small>
     <small>{x.instruction}</small>
    </div>)}
    {ladder?.finalRiskLeg&&<div className="historyRow">
     <span>Final risk leg</span><b>{odds(ladder.finalRiskLeg.odds)}</b>
     <small>{time(ladder.finalRiskLeg.startTime)} • {ladder.finalRiskLeg.selection}</small>
     <small>Primary early-cash-out decision point is before this leg begins.</small>
    </div>}
   </div>
  </div>

  <div className="historyNote">
   This section intentionally puts the later, longest acceptable odds last. A sportsbook cash-out offer can be compared with the existing Cash-Out calculator before accepting; no cash-out amount or profit is guaranteed.
  </div>
 </section>;
}
