'use client';
import {useEffect,useState} from 'react';

type ConsoleSnapshot={
 source:string;
 alerts:any[];
 decisions:any[];
 positions:any[];
 bankroll:any[];
 modelHealth:any[];
 lineMoves:any[];
};

const empty:ConsoleSnapshot={source:'loading',alerts:[],decisions:[],positions:[],bankroll:[],modelHealth:[],lineMoves:[]};

export default function LiveConsole(){
 const [data,setData]=useState<ConsoleSnapshot>(empty);
 const [error,setError]=useState('');

 useEffect(()=>{
  let active=true;
  const load=async()=>{
   try{
    const res=await fetch('/api/console',{cache:'no-store'});
    if(!res.ok)throw new Error('console unavailable');
    const json=await res.json();
    if(active){setData(json);setError('');}
   }catch(e){
    if(active)setError(e instanceof Error?e.message:'console unavailable');
   }
  };
  load();
  const id=setInterval(load,30000);
  return()=>{active=false;clearInterval(id)};
 },[]);

 const bankroll=data.bankroll?.[0];
 const openRisk=(data.positions||[]).reduce((s:number,p:any)=>s+Number(p.stake||0),0);
 const actionCount=(action:string)=>(data.decisions||[]).filter((d:any)=>d.action===action).length;

 return <section className="consolePanel">
  <div className="consoleHead">
   <div><div className="eyebrow">LIVE OPERATING CONSOLE</div><h3>Autonomous engine state</h3></div>
   <div className="consoleSource">{error?error:data.source==='database'?'DATABASE LIVE':'DEMO / NO DATABASE'}</div>
  </div>

  <div className="consoleStats">
   <div><small>OPEN POSITIONS</small><strong>{data.positions?.length||0}</strong></div>
   <div><small>OPEN RISK</small><strong>{'$'+openRisk.toFixed(0)}</strong></div>
   <div><small>ACTIVE ALERTS</small><strong>{data.alerts?.length||0}</strong></div>
   <div><small>DECISIONS</small><strong>{data.decisions?.length||0}</strong></div>
   <div><small>BANKROLL</small><strong>{bankroll?'$'+Number(bankroll.currentBankroll).toFixed(0):'—'}</strong></div>
  </div>

  <div className="consoleGrid">
   <div className="consoleCard">
    <div className="eyebrow">DECISION TIMELINE</div>
    {(data.decisions||[]).slice(0,8).map((d:any)=><div className="consoleRow" key={d.id}>
     <span className={'action action-'+String(d.action).toLowerCase()}>{d.action}</span>
     <div><b>{d.marketId||'portfolio'}</b><small>{Array.isArray(d.reasons)?d.reasons.join(' • '):'Decision recorded'}</small></div>
    </div>)}
    {!data.decisions?.length&&<p className="emptyState">No recorded decisions yet.</p>}
   </div>

   <div className="consoleCard">
    <div className="eyebrow">ALERT CENTER</div>
    {(data.alerts||[]).slice(0,8).map((a:any)=><div className="consoleRow" key={a.id}>
     <span className={'severity severity-'+String(a.severity).toLowerCase()}>{a.severity}</span>
     <div><b>{a.type}</b><small>{a.message}</small></div>
    </div>)}
    {!data.alerts?.length&&<p className="emptyState">No unresolved alerts.</p>}
   </div>

   <div className="consoleCard">
    <div className="eyebrow">OPEN POSITION MANAGER</div>
    {(data.positions||[]).slice(0,8).map((p:any)=><div className="consoleRow" key={p.id}>
     <span className={'action action-'+String(p.state||'open').toLowerCase()}>{p.state||'OPEN'}</span>
     <div><b>{p.selectionKey||p.marketKey}</b><small>{p.sport+' • $'+Number(p.stake||0).toFixed(2)+' • EV '+Number((p.currentExpectedValue??p.expectedValue??0)*100).toFixed(1)+'%'}</small></div>
    </div>)}
    {!data.positions?.length&&<p className="emptyState">No open database positions.</p>}
   </div>

   <div className="consoleCard">
    <div className="eyebrow">MODEL HEALTH</div>
    {(data.modelHealth||[]).slice(0,8).map((m:any,i:number)=><div className="healthRow" key={i}>
     <div><b>{m.sport+' • '+m.marketKey}</b><small>{'n='+(m.sampleSize||0)+' • Brier '+(m.brierScore==null?'—':Number(m.brierScore).toFixed(3))+' • CLV '+(m.avgClv==null?'—':(Number(m.avgClv)*100).toFixed(1)+'%')}</small></div>
     <span className={Number(m.roi||0)>=0?'lime':'orange'}>{m.roi==null?'—':(Number(m.roi)*100).toFixed(1)+'%'}</span>
    </div>)}
    {!data.modelHealth?.length&&<p className="emptyState">Model scorecards populate after settled history.</p>}
   </div>
  </div>

  <div className="consoleFooter">
   <span>{'OPEN '+actionCount('OPEN')}</span><span>{'HOLD '+actionCount('HOLD')}</span><span>{'REDUCE '+actionCount('REDUCE')}</span><span>{'HEDGE '+actionCount('HEDGE')}</span><span>{'REMOVE '+actionCount('REMOVE')}</span>
  </div>
 </section>
}