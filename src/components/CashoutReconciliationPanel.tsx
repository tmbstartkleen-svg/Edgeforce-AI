'use client';

import {useEffect,useState} from 'react';

type PreviewRow={observationId:number;eventKey:string;resolutionStatus:string;proposedOutcome:string;canSettle:boolean;reason:string};
type Payload={
 preview:{summary:{pending:number;matched:number;settleable:number;disputed:number};rows:PreviewRow[]};
 summary:{totals:{settled:number;pending:number;won:number;lost:number;void:number};rows:Array<{sportsbook:string;user_action:string;samples:number;settled:number;avg_offer_edge:number|null;avg_realized_advantage:number|null}>};
};

export default function CashoutReconciliationPanel(){
 const [data,setData]=useState<Payload|null>(null);
 const [error,setError]=useState('');
 useEffect(()=>{
  let active=true;
  const load=async()=>{
   try{
    const res=await fetch('/api/intelligence/cashout-reconciliation',{cache:'no-store'});
    if(!res.ok)throw new Error('cash-out reconciliation unavailable');
    const json=await res.json() as Payload;
    if(active){setData(json);setError('')}
   }catch(e){if(active)setError(e instanceof Error?e.message:'cash-out reconciliation unavailable')}
  };
  void load();
  const timer=window.setInterval(()=>void load(),120000);
  return()=>{active=false;window.clearInterval(timer)};
 },[]);

 return <section className="v21Panel">
  <div className="v21PanelHead">
   <div><div className="eyebrow">V116 CASH-OUT RECONCILIATION</div><h3>Settlement & Counterfactual Outcome Engine</h3></div>
   <div className="panelMeta"><span>Settleable {data?.preview.summary.settleable||0}</span><span>Pending {data?.preview.summary.pending||0}</span><span>Disputed {data?.preview.summary.disputed||0}</span></div>
  </div>
  {error&&<div className="v21Alert">{error}</div>}
  <div className="historyGrid">
   <div className="historyBox">
    <h4>Pending reconciliation</h4>
    {(data?.preview.rows||[]).slice(0,12).map(x=><div className="historyRow" key={x.observationId}>
     <span>Observation #{x.observationId}</span><b>{x.canSettle?'READY':'WAIT'}</b>
     <small>{x.eventKey||'no event key'} • {x.resolutionStatus} • proposed {x.proposedOutcome}</small>
     <small>{x.reason}</small>
    </div>)}
    {!data?.preview.rows?.length&&<div className="historyRow"><span>No pending observations</span><b>CLEAR</b><small>All recorded cash-out observations are settled or none have been recorded.</small></div>}
   </div>
   <div className="historyBox">
    <h4>Settlement totals</h4>
    <div className="historyRow"><span>Settled</span><b>{data?.summary.totals.settled||0}</b><small>Completed cash-out observations available for V115/V114 learning.</small></div>
    <div className="historyRow"><span>Pending</span><b>{data?.summary.totals.pending||0}</b><small>Still waiting on event truth or linkage.</small></div>
    <div className="historyRow"><span>Won / Lost / Void</span><b>{data?.summary.totals.won||0} / {data?.summary.totals.lost||0} / {data?.summary.totals.void||0}</b><small>Underlying hold-counterfactual outcomes.</small></div>
   </div>
  </div>
  <div className="historyNote">V116 reconciles recorded observations against EdgeForce event truth. It does not place bets, accept cash-outs, or alter sportsbook accounts.</div>
 </section>;
}