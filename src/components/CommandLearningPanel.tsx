'use client';

import {useEffect,useState} from 'react';

type Row={
 commandType:string;samples:number;gradedSamples:number;positiveSamples:number;positiveRate:number;
 averageUtility:number;confidence:number;multiplier:number;evidence:string;state:string;
};
type Payload={configured:boolean;rows:Row[];ungradedCashout:number};

const pct=(n:number)=>(n*100).toFixed(1)+'%';

export default function CommandLearningPanel(){
 const [data,setData]=useState<Payload|null>(null);
 const [error,setError]=useState('');
 useEffect(()=>{
  let active=true;
  const load=async()=>{
   try{
    const res=await fetch('/api/intelligence/command-effectiveness',{cache:'no-store'});
    if(!res.ok)throw new Error('command effectiveness unavailable');
    const json=await res.json() as Payload;
    if(active){setData(json);setError('')}
   }catch(e){if(active)setError(e instanceof Error?e.message:'command effectiveness unavailable')}
  };
  void load();
  const timer=window.setInterval(()=>void load(),120000);
  return()=>{active=false;window.clearInterval(timer)};
 },[]);

 return <section className="v21Panel">
  <div className="v21PanelHead">
   <div><div className="eyebrow">V114 COMMAND LEARNING</div><h3>Alert Effectiveness & Priority Tuning</h3></div>
   <div className="panelMeta"><span>Sample-shrunk</span><span>Cash-out ungraded {data?.ungradedCashout||0}</span></div>
  </div>
  {error&&<div className="v21Alert">{error}</div>}
  <div className="historyGrid">
   <div className="historyBox">
    <h4>Command effectiveness</h4>
    {(data?.rows||[]).map(x=><div className="historyRow" key={x.commandType}>
     <span>{x.commandType}</span><b>{x.state} · {x.multiplier.toFixed(3)}×</b>
     <small>issued {x.samples} • graded {x.gradedSamples} • positive {pct(x.positiveRate)}</small>
     <small>utility {pct(x.averageUtility)} • confidence {pct(x.confidence)} • {x.evidence}</small>
    </div>)}
    {!data?.rows?.length&&<div className="historyRow"><span>No graded command history yet</span><b>NEUTRAL</b><small>The queue stays at default weights until enough post-alert evidence exists.</small></div>}
   </div>
   <div className="historyBox">
    <h4>Learning safeguards</h4>
    <div className="historyRow"><span>Small-sample shrinkage</span><b>ON</b><small>Short streaks are pulled toward neutral.</small></div>
    <div className="historyRow"><span>Bounded effect</span><b>0.94×–1.06×</b><small>Command learning only fine-tunes ordering.</small></div>
    <div className="historyRow"><span>Cash-out learning</span><b>UNSCORED</b><small>No effectiveness claim without a recorded offer/action/result.</small></div>
    <div className="historyRow"><span>Execution</span><b>OFF</b><small>No alert automatically places, closes, trades, or cashes out anything.</small></div>
   </div>
  </div>
 </section>;
}
