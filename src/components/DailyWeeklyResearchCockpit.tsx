'use client';

import Link from 'next/link';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {buildDailyWeeklyResearch,type ResearchContextChange,type ResearchRow,type ResearchScope,type ResearchSession} from '@/lib/dailyWeeklyResearch';
import styles from './DailyWeeklyResearchCockpit.module.css';

type Payload={
 generatedAt?:string;
 source?:string;
 providerName?:string;
 providerMode?:string;
 providerDegraded?:boolean;
 providerQuality?:{grade?:string;qualityScore?:number;payloadAgeMin?:number}|null;
 targetBook?:string;
 warnings?:string[];
 rows?:ResearchRow[];
 sports?:string[];
 contextChanges?:ResearchContextChange[];
 resimulationTriggered?:boolean;
 topBoardQualification?:{
  forced?:boolean;allowedGrades?:string[];minimumSimProbability?:number;minimumDynamicConfidence?:number;
  fallbackMode?:string|null;fallbackReason?:string|null;withheld?:number;qualified?:number;shown?:number;
 };
};

const pct=(value?:number)=>Number.isFinite(value)?(Number(value)*100).toFixed(1)+'%':'—';
const ev=(value?:number)=>{
 if(!Number.isFinite(value))return '—';
 const n=Number(value);
 return (Math.abs(n)<=1?n*100:n).toFixed(1)+'%';
};
const odds=(value?:number)=>Number.isFinite(value)?(Number(value)>0?'+':'')+Number(value):'—';
const time=(value?:string)=>{
 const d=new Date(String(value||''));
 return Number.isFinite(d.getTime())?d.toLocaleString([], {weekday:'short',hour:'numeric',minute:'2-digit'}):'TBD';
};
const age=(generatedAt?:string)=>{
 const t=Date.parse(String(generatedAt||''));
 if(!Number.isFinite(t))return 'unknown';
 const mins=Math.max(0,Math.round((Date.now()-t)/60000));
 return mins<1?'under 1m':mins+'m';
};

async function fetchResearchSnapshot():Promise<Payload>{
 const response=await fetch('/api/live-board?view=week&limit=50&risk=Moderate',{cache:'no-store'});
 const payload=await response.json() as Payload & {error?:string;message?:string};
 if(!response.ok)throw new Error(payload.message||payload.error||'Research snapshot unavailable');
 return payload;
}

export default function DailyWeeklyResearchCockpit(){
 const [data,setData]=useState<Payload|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [scope,setScope]=useState<ResearchScope>('today');
 const [sport,setSport]=useState('ALL');
 const [session,setSession]=useState<ResearchSession>('ALL');

 const refresh=useCallback(async()=>{
  setLoading(true);setError('');
  try{
   setData(await fetchResearchSnapshot());
  }catch(e){
   setData(null);
   setError(e instanceof Error?e.message:'Research snapshot unavailable');
  }finally{setLoading(false)}
 },[]);

 useEffect(()=>{
  let active=true;
  fetchResearchSnapshot()
   .then(payload=>{if(active){setData(payload);setError('')}})
   .catch(e=>{if(active){setData(null);setError(e instanceof Error?e.message:'Research snapshot unavailable')}})
   .finally(()=>{if(active)setLoading(false)});
  return()=>{active=false};
 },[]);

 const report=useMemo(()=>buildDailyWeeklyResearch(
  data?.rows||[],
  data?.contextChanges||[],
  {scope,sport,session,qualification:data?.topBoardQualification}
 ),[data,scope,sport,session]);

 const sports=useMemo(()=>['ALL',...new Set((data?.rows||[]).map(row=>row.sport).filter(Boolean))],[data]);
 const fallback=Boolean(data?.topBoardQualification?.forced);
 const providerLabel=data?.providerName||data?.source||'Unverified source';

 return <section className={styles.cockpit} aria-label="Daily and weekly sports research cockpit">
  <div className={styles.head}>
   <div>
    <div className="eyebrow">V195 • DAILY / WEEKLY RESEARCH</div>
    <h2>One snapshot. Every research flag visible.</h2>
    <p>Daily and weekly boards are derived from one live-board snapshot. This view never converts fallback rows into picks, never hides context changes, and never places wagers or exchange orders.</p>
   </div>
   <span className={styles.mode}>{fallback?'MARKET-SIM FALLBACK':'STRICT EDGE BOARD'}</span>
  </div>

  <div className={styles.controls}>
   <label>Window<select value={scope} onChange={e=>setScope(e.target.value as ResearchScope)}><option value="today">Today</option><option value="week">This week</option></select></label>
   <label>Sport<select value={sport} onChange={e=>setSport(e.target.value)}>{sports.map(x=><option key={x} value={x}>{x==='ALL'?'All sports':x}</option>)}</select></label>
   <label>Start window<select value={session} onChange={e=>setSession(e.target.value as ResearchSession)}><option value="ALL">All times</option><option value="AM">AM</option><option value="PM">PM</option></select></label>
   <button type="button" disabled={loading} onClick={()=>void refresh()}>{loading?'Refreshing…':'Refresh snapshot'}</button>
  </div>

  {data&&<div className={styles.status}>
   <span><strong>{providerLabel}</strong> · {data.providerMode||'source mode unavailable'}</span>
   <span>Snapshot age {age(data.generatedAt)}</span>
   <span>Target book {data.targetBook||'not specified'}</span>
   <span>Quality {data.providerQuality?.grade||'unrated'}{Number.isFinite(data.providerQuality?.qualityScore)?' · '+Math.round(Number(data.providerQuality?.qualityScore)*100)+'%':''}</span>
   {data.providerDegraded&&<span>Provider degraded</span>}
  </div>}

  {error&&<div className={styles.notice+' '+styles.error}>{error}. No research rows are fabricated when the live-board snapshot is unavailable.</div>}
  {fallback&&data?.topBoardQualification?.fallbackReason&&<div className={styles.notice}>{data.topBoardQualification.fallbackReason} These rows remain research-only and are labeled FALLBACK below.</div>}
  {!fallback&&data?.topBoardQualification&&<div className={styles.notice}>Strict qualification active: grades {(data.topBoardQualification.allowedGrades||['ELITE','STRONG']).join(' / ')} · minimum simulation {pct(data.topBoardQualification.minimumSimProbability)} · minimum dynamic confidence {pct(data.topBoardQualification.minimumDynamicConfidence)}.</div>}

  <div className={styles.kpis}>
   <article><small>VISIBLE ROWS</small><strong>{report.visible}</strong></article>
   <article><small>STRICT QUALIFIERS</small><strong>{report.strict}</strong></article>
   <article><small>FALLBACK / REVIEW</small><strong>{report.fallback}</strong></article>
   <article><small>CONTEXT FLAGS</small><strong>{report.contextFlagged}</strong></article>
   <article><small>ACTION / WATCH CHANGES</small><strong>{report.materialContextFlagged}</strong></article>
  </div>

  <div className={styles.grid}>
   <div className={styles.panel}>
    <div className={styles.panelHead}><div className="eyebrow">RANKED RESEARCH</div><h3>{scope==='today'?'Today':'This week'} · {sport==='ALL'?'All sports':sport} · {session==='ALL'?'All start times':session}</h3></div>
    {report.rows.length?<div className={styles.tableWrap}><table className={styles.table}>
     <thead><tr><th>Start</th><th>Sport / event</th><th>Market</th><th>Price</th><th>Sim</th><th>Model</th><th>EV</th><th>Evidence</th><th>Context</th></tr></thead>
     <tbody>{report.rows.map(({row,strict,contextChanges})=>{
      const latest=contextChanges[0];
      const severity=latest?.severity||'INFO';
      const severityClass=severity==='ACTION'?styles.action:severity==='WATCH'?styles.watch:styles.info;
      return <tr key={row.id}>
       <td>{time(row.startTime)}<small>{row.freshness||'freshness unavailable'}{Number.isFinite(row.sourceAgeMin)?' · '+Number(row.sourceAgeMin).toFixed(0)+'m source age':''}</small></td>
       <td><b>{row.sport}{row.league?' · '+row.league:''}</b><small>{row.event}</small></td>
       <td><b>{row.selection}</b><small>{row.market}</small></td>
       <td>{odds(row.odds)}</td><td>{pct(row.simProbability)}</td><td>{pct(row.modelProb)}</td><td>{ev(row.expectedValue)}</td>
       <td><span className={styles.badge+' '+(strict?styles.strict:styles.fallback)}>{strict?'STRICT':'FALLBACK'}</span><small>{row.grade||'ungraded'} · {row.confidenceLabel||'confidence unlabeled'}</small></td>
       <td>{latest?<><span className={styles.badge+' '+severityClass}>{severity}</span><small>{latest.type||'context change'} · {latest.reason||'reason unavailable'}</small></>:<span className={styles.badge+' '+styles.info}>NO NEW FLAG</span>}</td>
      </tr>;
     })}</tbody>
    </table></div>:<div className={styles.empty}>{loading?'Loading research snapshot…':'No returned live-board rows match these filters. Missing rows are not converted into zero-probability events.'}</div>}
   </div>

   <aside className={styles.panel}>
    <div className={styles.panelHead}><div className="eyebrow">RESEARCH SEQUENCE</div><h3>Next events to review</h3></div>
    <div className={styles.sequence}>{report.rows.slice(0,8).map(({row,strict,contextChanges})=><div className={styles.sequenceRow} key={row.id}>
     <time>{time(row.startTime)}</time>
     <div><b>{row.event}</b><small>{row.selection} · {row.market}{contextChanges.length?' · '+contextChanges.length+' context flag'+(contextChanges.length===1?'':'s'):''}</small></div>
     <span className={styles.badge+' '+(strict?styles.strict:styles.fallback)}>{strict?'STRICT':'REVIEW'}</span>
    </div>)}{!report.rows.length&&<div className={styles.empty}>No events to sequence for the selected filters.</div>}</div>
    <div className={styles.foot}>Sequence is chronological research priority only—not a parlay, stake plan, or instruction to wager.
     <div className={styles.links}><Link href="/player-research">Player history</Link><Link href="/predictions">Prediction markets</Link><Link href="/coverage">Coverage gaps</Link></div>
    </div>
   </aside>
  </div>

  {(data?.warnings?.length||0)>0&&<div className={styles.foot}><strong>Source warnings:</strong> {data!.warnings!.slice(0,6).join(' · ')}</div>}
  <div className={styles.foot}>Manual refresh only. The cockpit makes one week-view live-board request and derives Today / This Week / AM / PM locally, preventing duplicate research polling from this page.</div>
 </section>;
}
