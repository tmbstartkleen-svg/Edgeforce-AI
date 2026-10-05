'use client';

import {useEffect,useState} from 'react';

type Row={
 alertType:'CASHOUT_REVIEW'|'FINAL_LEG_REVIEW';samples:number;gradedSamples:number;positiveSamples:number;
 positiveRate:number;averageDecisionUtility:number;averageOfferEdge:number;confidence:number;multiplier:number;
 state:'BOOST'|'NEUTRAL'|'REDUCE'|'UNSCORED';
};
type Payload={configured:boolean;rows:Row[];pending:number};

const pct=(n:number)=>(n*100).toFixed(1)+'%';

export default function CashoutLearningPanel(){
 const [data,setData]=useState<Payload|null>(null);
 const [error,setError]=useState('');
 useEffect(()=>{
  let active=true;
  const load=async()=>{
   try{
    const res=await fetch('/api/intelligence/cashout-learning',{cache:'no-store'});
    if(!res.ok)throw new Error('cash-out learning unavailable');
    const json=await res.json() as Payload;
    if(active){setData(json);setError('')}
   }catch(e){if(active)setError(e instanceof Error?e.message:'cash-out learning unavailable')}
  };
  void load();
  const timer=window.setInterval(()=>void load(),120000);
  return()=>{active=false;window.clearInterval(timer)};
 },[]);

 return <section className="v21Panel">
  <div className="v21PanelHead">
   <div><div className="eyebrow">V115 CASH-OUT LEARNING</div><h3>Offer Capture & Decision Quality</h3></div>
   <div className="panelMeta"><span>Pending {data?.pending||0}</span><span>Real outcomes only</span></div>
  </div>
  {error&&<div className="v21Alert">{error}</div>}
  <div className="historyGrid">
   <div className="historyBox">
    <h4>Cash-out alert effectiveness</h4>
    {(data?.rows||[]).map(x=><div className="historyRow" key={x.alertType}>
     <span>{x.alertType}</span><b>{x.state} · {x.multiplier.toFixed(3)}×</b>
     <small>recorded {x.samples} • graded {x.gradedSamples} • positive {pct(x.positiveRate)}</small>
     <small>decision utility {pct(x.averageDecisionUtility)} • avg offer edge {x.averageOfferEdge>=0?'+':''}{x.averageOfferEdge.toFixed(2)} • confidence {pct(x.confidence)}</small>
    </div>)}
    {!data?.rows?.length&&<div className="historyRow"><span>No recorded cash-out outcomes yet</span><b>UNSCORED</b><small>V115 will not infer effectiveness until real offer/action/outcome records exist.</small></div>}
   </div>
   <div className="historyBox">
    <h4>Learning rules</h4>
    <div className="historyRow"><span>Offer required</span><b>YES</b><small>Actual sportsbook cash-out amount must be recorded.</small></div>
    <div className="historyRow"><span>Action required</span><b>YES</b><small>CASH_OUT, HOLD, or NO_ACTION is stored explicitly.</small></div>
    <div className="historyRow"><span>Outcome required</span><b>YES</b><small>Pending observations never count as graded evidence.</small></div>
    <div className="historyRow"><span>Automatic execution</span><b>OFF</b><small>EdgeForce records and learns from decisions; it does not accept cash-out offers automatically.</small></div>
   </div>
  </div>
 </section>;
}