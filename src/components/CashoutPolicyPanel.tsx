'use client';

import {useEffect,useState} from 'react';

type Policy={sportsbook:string;alertType:'CASHOUT_REVIEW'|'FINAL_LEG_REVIEW';samples:number;thresholdEdgePct:number;rawBestThresholdPct:number;baselineThresholdPct:number;classificationAccuracy:number;confidence:number;state:string};
type Eval={sportsbook:string;alertType:'CASHOUT_REVIEW'|'FINAL_LEG_REVIEW';edgePct:number;learnedThresholdPct:number;state:'STRONG_CASHOUT'|'CASHOUT'|'NEUTRAL'|'HOLD';confidence:number;policyState:string;reason:string};
type Payload={rows:Policy[];evaluations:Eval[]};
const pct=(n:number)=>(n*100).toFixed(1)+'%';

export default function CashoutPolicyPanel(){
 const [data,setData]=useState<Payload|null>(null);
 const [error,setError]=useState('');
 useEffect(()=>{
  let active=true;
  const load=async()=>{
   try{
    const res=await fetch('/api/intelligence/cashout-policy',{cache:'no-store'});
    if(!res.ok)throw new Error('cash-out policy unavailable');
    const json=await res.json() as Payload;
    if(active){setData(json);setError('')}
   }catch(e){if(active)setError(e instanceof Error?e.message:'cash-out policy unavailable')}
  };
  void load();
  const timer=window.setInterval(()=>void load(),120000);
  return()=>{active=false;window.clearInterval(timer)};
 },[]);

 return <section className="v21Panel">
  <div className="v21PanelHead">
   <div><div className="eyebrow">V117 CASH-OUT POLICY</div><h3>Learned Offer Thresholds & Advisory Bands</h3></div>
   <div className="panelMeta"><span>Policies {data?.rows.length||0}</span><span>Pending evaluated {data?.evaluations.length||0}</span></div>
  </div>
  {error&&<div className="v21Alert">{error}</div>}
  <div className="historyGrid">
   <div className="historyBox">
    <h4>Learned sportsbook policies</h4>
    {(data?.rows||[]).slice(0,12).map(x=><div className="historyRow" key={x.sportsbook+'|'+x.alertType}>
     <span>{x.sportsbook} · {x.alertType}</span><b>{x.state}</b>
     <small>threshold {pct(x.thresholdEdgePct)} of stake • raw fit {pct(x.rawBestThresholdPct)} • baseline {pct(x.baselineThresholdPct)}</small>
     <small>n={x.samples} • fit accuracy {pct(x.classificationAccuracy)} • confidence {pct(x.confidence)}</small>
    </div>)}
    {!data?.rows?.length&&<div className="historyRow"><span>No learned policy yet</span><b>DEFAULT</b><small>EdgeForce stays on the original 1% cash-out edge threshold until settled history accumulates.</small></div>}
   </div>
   <div className="historyBox">
    <h4>Current pending offer evaluations</h4>
    {(data?.evaluations||[]).slice(0,12).map((x,i)=><div className="historyRow" key={i+'|'+x.sportsbook+'|'+x.alertType}>
     <span>{x.sportsbook} · {x.alertType}</span><b>{x.state}</b>
     <small>offer edge {pct(x.edgePct)} of stake • learned threshold {pct(x.learnedThresholdPct)}</small>
     <small>policy {x.policyState} • confidence {pct(x.confidence)} • {x.reason}</small>
    </div>)}
    {!data?.evaluations?.length&&<div className="historyRow"><span>No pending cash-out offers</span><b>CLEAR</b><small>There are no unresolved recorded offers to evaluate.</small></div>}
   </div>
  </div>
  <div className="historyNote">V117 is advisory only. Learned policy bands can improve consistency, but sportsbook offers, model estimates, and outcomes remain uncertain.</div>
 </section>;
}