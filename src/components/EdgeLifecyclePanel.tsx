'use client';

import {useEffect,useMemo,useState} from 'react';

type Row={
 id:string;domain:'SPORTS'|'MARKETS';category:string;venue:string;title:string;edge:number;masterScore:number;
 lifecycleState:'NEW'|'STRENGTHENING'|'STABLE'|'WEAKENING'|'DECAYED'|'EXIT';
 priorMasterScore:number|null;priorEdge:number|null;scoreDelta:number|null;edgeDelta:number|null;
 ageMinutes:number|null;actionLabel:'WATCH'|'HOLD'|'RECHECK'|'REMOVE';reason:string;
};
type Payload={
 configured:boolean;persisted:boolean;
 summary:{new:number;strengthening:number;stable:number;weakening:number;decayed:number;exit:number};
 rows:Row[];exits:Row[];
};

const pct=(n:number)=>(n*100).toFixed(1)+'%';
const pts=(n:number)=>(n>=0?'+':'')+(n*100).toFixed(1)+' pts';

export default function EdgeLifecyclePanel(){
 const [data,setData]=useState<Payload|null>(null);
 const [error,setError]=useState('');

 useEffect(()=>{
  let active=true;
  const load=async()=>{
   try{
    const res=await fetch('/api/intelligence/edge-lifecycle',{cache:'no-store'});
    if(!res.ok)throw new Error('edge lifecycle unavailable');
    const json=await res.json() as Payload;
    if(active){setData(json);setError('')}
   }catch(e){if(active)setError(e instanceof Error?e.message:'edge lifecycle unavailable')}
  };
  void load();
  const timer=window.setInterval(()=>void load(),60000);
  return ()=>{active=false;window.clearInterval(timer)};
 },[]);

 const important=useMemo(()=>[...(data?.rows||[]),...(data?.exits||[])]
  .filter(x=>x.lifecycleState!=='STABLE')
  .sort((a,b)=>{
   const rank={STRENGTHENING:5,NEW:4,WEAKENING:3,DECAYED:2,EXIT:1,STABLE:0};
   return rank[b.lifecycleState]-rank[a.lifecycleState]||b.masterScore-a.masterScore;
  }).slice(0,14),[data]);

 return <section className="v21Panel">
  <div className="v21PanelHead">
   <div>
    <div className="eyebrow">V106 EDGE LIFECYCLE</div>
    <h3>Opportunity Strength, Decay & Exit Monitor</h3>
   </div>
   <div className="panelMeta">
    <span>↑ {data?.summary.strengthening||0}</span>
    <span>↓ {data?.summary.weakening||0}</span>
    <span>Exit {data?.summary.exit||0}</span>
   </div>
  </div>

  {error&&<div className="v21Alert">{error}</div>}

  <div className="historyGrid">
   <div className="historyBox">
    <h4>Lifecycle changes</h4>
    {important.map(x=><div className="historyRow" key={x.lifecycleState+'|'+x.id}>
     <span>{x.title}</span><b>{x.lifecycleState}</b>
     <small>{x.domain} • {x.category} • {x.venue} • edge {pts(x.edge)} • score {pct(x.masterScore)}</small>
     <small>{x.actionLabel} • {x.scoreDelta===null?'no prior score':'score Δ '+(x.scoreDelta>=0?'+':'')+pct(x.scoreDelta)} • {x.reason}</small>
    </div>)}
    {!important.length&&<div className="historyRow"><span>No material lifecycle changes</span><b>STABLE</b><small>Current Master Edge opportunities have not moved enough to trigger a state change.</small></div>}
   </div>

   <div className="historyBox">
    <h4>Lifecycle summary</h4>
    <div className="historyRow"><span>New</span><b>{data?.summary.new||0}</b><small>Newly surfaced opportunities without a recent comparable snapshot.</small></div>
    <div className="historyRow"><span>Strengthening</span><b>{data?.summary.strengthening||0}</b><small>Score or model-market gap improved materially.</small></div>
    <div className="historyRow"><span>Weakening</span><b>{data?.summary.weakening||0}</b><small>Score or edge deteriorated enough to warrant a re-check.</small></div>
    <div className="historyRow"><span>Decayed / Exit</span><b>{(data?.summary.decayed||0)+(data?.summary.exit||0)}</b><small>No longer clears the lifecycle floor or disappeared from the current Master Edge board.</small></div>
   </div>
  </div>

  <div className="historyNote">V106 is an attention and risk-monitoring layer. It can tell EdgeForce when an opportunity is fading or no longer qualifies, but it does not automatically place, cash out, close, or trade anything.</div>
 </section>;
}
