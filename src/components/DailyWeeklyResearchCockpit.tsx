'use client';

import Link from 'next/link';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {buildDailyWeeklyResearch,formatResearchRoi,hasResearchQualification,isResearchRow,RESEARCH_TIME_ZONE,type ResearchContextChange,type ResearchQualification,type ResearchRow,type ResearchScope,type ResearchSession} from '@/lib/dailyWeeklyResearch';
import {createOperationsRequestScope} from '@/lib/operations-request.mjs';
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
 topBoardQualification?:ResearchQualification;
};

const pct=(value?:number)=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1?(value*100).toFixed(1)+'%':'—';
const odds=(value?:number)=>Number.isSafeInteger(value)&&Math.abs(Number(value))>=100?(Number(value)>0?'+':'')+Number(value):'—';
const time=(value?:string)=>{
 const d=new Date(String(value||''));
 return Number.isFinite(d.getTime())?d.toLocaleString('en-US', {timeZone:RESEARCH_TIME_ZONE,weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}):'TBD';
};
const age=(now:number,generatedAt?:string)=>{
 const t=Date.parse(String(generatedAt||''));
 if(!Number.isFinite(t)||t>now+30000)return 'unknown';
 const mins=Math.max(0,Math.floor((now-t)/60000));
 return mins<1?'under 1m':mins+'m';
};

async function fetchResearchSnapshot(signal:AbortSignal):Promise<Payload>{
 const response=await fetch('/api/live-board?view=week&limit=50&risk=Moderate',{cache:'no-store',signal});
 let payload:Payload & {error?:string;message?:string};
 try{payload=await response.json()}catch{throw new Error('Research service returned an unexpected response')}
 if(!response.ok)throw new Error(payload?.message||payload?.error||'Research snapshot unavailable');
 if(!payload||!Array.isArray(payload.rows)||!payload.rows.every(isResearchRow))throw new Error('Research snapshot has an invalid row collection');
 return payload;
}

export default function DailyWeeklyResearchCockpit(){
 const [data,setData]=useState<Payload|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [scope,setScope]=useState<ResearchScope>('today');
 const [sport,setSport]=useState('ALL');
 const [session,setSession]=useState<ResearchSession>('ALL');
 const [clock,setClock]=useState(()=>Date.now());
 const [requestScope]=useState(()=>createOperationsRequestScope());

 const loadSnapshot=useCallback(()=>{
  const request=requestScope.begin(30000);
  return fetchResearchSnapshot(request.signal).then(payload=>{
   if(!request.isCurrent())return;
   if(request.signal.aborted)throw new Error('Research request timed out');
   setData(payload);setClock(Date.now());setError('');
  }).catch(e=>{
   if(!request.isCurrent())return;
   setData(null);
   setError(request.signal.aborted?'Research request timed out. Refresh to try again':e instanceof Error?e.message:'Research snapshot unavailable');
  }).finally(()=>{
   request.finish();
   if(request.isCurrent())setLoading(false);
  });
 },[requestScope]);

 const refresh=()=>{
  setLoading(true);setError('');setData(null);
  void loadSnapshot();
 };

 useEffect(()=>{
  void loadSnapshot();
  return()=>requestScope.reset();
 },[loadSnapshot,requestScope]);

 useEffect(()=>{
  // Advance displayed ages and expire filters locally; this makes no network requests.
  const timer=setInterval(()=>setClock(Date.now()),60000);
  return()=>clearInterval(timer);
 },[]);

 const report=useMemo(()=>buildDailyWeeklyResearch(
  data?.rows||[],
  data?.contextChanges||[],
  {scope,sport,session,now:new Date(clock),snapshotAt:data?.generatedAt,qualification:data?.topBoardQualification}
 ),[data,scope,sport,session,clock]);

 const sports=useMemo(()=>['ALL',...new Set((data?.rows||[]).map(row=>row.sport).filter(Boolean))],[data]);
 const fallback=Boolean(data?.topBoardQualification?.forced);
 const qualifiedMetadata=hasResearchQualification(data?.topBoardQualification);
 const providerLabel=data?.providerName||data?.source||'Unverified source';
 const mode=loading?'LOADING SNAPSHOT':!data?'SNAPSHOT UNAVAILABLE':fallback?'MARKET-SIM FALLBACK':
  report.strict>0?'QUALIFIED RESEARCH':'REVIEW SNAPSHOT';
 const known=Boolean(data)&&!loading;

 return <section className={styles.cockpit} aria-label="Daily and weekly sports research cockpit">
  <div className={styles.head}>
   <div>
    <div className="eyebrow">DAILY / WEEKLY RESEARCH</div>
    <h2>Review upcoming games with source context.</h2>
    <p>Today and the next seven days share one returned board snapshot of up to 50 rows. It is a research sample, not a complete inventory of every sport or market. This view never places wagers or exchange orders.</p>
   </div>
   <span className={styles.mode} role="status">{mode}</span>
  </div>

  <div className={styles.controls}>
   <label>Window · Eastern Time<select value={scope} onChange={e=>setScope(e.target.value as ResearchScope)}><option value="today">Today · upcoming</option><option value="week">Next 7 days · upcoming</option></select></label>
   <label>Sport<select value={sport} onChange={e=>setSport(e.target.value)}>{sports.map(x=><option key={x} value={x}>{x==='ALL'?'All sports':x}</option>)}</select></label>
   <label>Start window<select value={session} onChange={e=>setSession(e.target.value as ResearchSession)}><option value="ALL">All times</option><option value="AM">AM</option><option value="PM">PM</option></select></label>
   <button type="button" disabled={loading} onClick={refresh}>{loading?'Refreshing…':'Refresh snapshot'}</button>
  </div>

  {data&&<div className={styles.status}>
   <span><strong>{providerLabel}</strong> · {data.providerMode||'source mode unavailable'}</span>
   <span>Snapshot age {age(clock,data.generatedAt)}</span>
   <span>Dates and AM / PM use America/New_York</span>
   <span>Target book {data.targetBook||'not specified'}</span>
   <span>Quality {data.providerQuality?.grade||'unrated'}{Number.isFinite(data.providerQuality?.qualityScore)?' · '+Math.round(Number(data.providerQuality?.qualityScore)*100)+'%':''}</span>
   {data.providerDegraded&&<span>Provider degraded</span>}
  </div>}

  {error&&<div className={styles.notice+' '+styles.error} role="alert">{error}. Research rows are unavailable.</div>}
  {fallback&&data?.topBoardQualification?.fallbackReason&&<div className={styles.notice}>{data.topBoardQualification.fallbackReason} These rows remain research-only and are labeled FALLBACK below.</div>}
  {qualifiedMetadata&&data?.topBoardQualification&&<div className={styles.notice}>Board filters: grades {data.topBoardQualification.allowedGrades!.join(' / ')} · minimum simulation {pct(data.topBoardQualification.minimumSimProbability)} · minimum dynamic confidence {pct(data.topBoardQualification.minimumDynamicConfidence)}. FILTERS MET also requires a valid provider timestamp, source age of at most 20 minutes and ready context when supplied. It does not certify an independent model edge.</div>}
  {data&&!fallback&&!qualifiedMetadata&&<div className={styles.notice}>Qualification metadata is incomplete. Returned rows remain available for review.</div>}
  {report.unknownStartTimes>0&&<div className={styles.notice}>{report.unknownStartTimes} returned row{report.unknownStartTimes===1?' has':'s have'} an unverified start time and cannot be assigned to a date window.</div>}

  <div className={styles.kpis}>
   <article><small>VISIBLE ROWS</small><strong>{known?report.visible:'—'}</strong></article>
   <article><small>MEET BOARD FILTERS</small><strong>{known?report.strict:'—'}</strong></article>
   <article><small>FALLBACK / REVIEW</small><strong>{known?report.fallback:'—'}</strong></article>
   <article><small>CONTEXT FLAGS</small><strong>{known?report.contextFlagged:'—'}</strong></article>
   <article><small>ACTION / WATCH CHANGES</small><strong>{known?report.materialContextFlagged:'—'}</strong></article>
  </div>

  <div className={styles.grid}>
   <div className={styles.panel}>
    <div className={styles.panelHead}><div className="eyebrow">UPCOMING RESEARCH · EASTERN TIME</div><h3>{scope==='today'?'Today':'Next 7 days'} · {sport==='ALL'?'All sports':sport} · {session==='ALL'?'All start times':session}</h3></div>
    {report.rows.length?<div className={styles.tableWrap}><table className={styles.table}>
     <thead><tr><th>Start</th><th>Sport / event</th><th>Market</th><th>Price</th><th>Sim</th><th>Model</th><th>EV / stake</th><th>Evidence</th><th>Context</th></tr></thead>
     <tbody>{report.rows.map(({row,strict,contextChanges,sourceAgeMin,freshness},index)=>{
      const latest=contextChanges[0];
      const severity=latest?.severity||'INFO';
      const severityClass=severity==='ACTION'?styles.action:severity==='WATCH'?styles.watch:styles.info;
      return <tr key={`${row.id}:${row.startTime}:${index}`}>
       <td>{time(row.startTime)}<small>{freshness}{sourceAgeMin!==undefined?' · '+sourceAgeMin.toFixed(1)+'m source age':''}</small></td>
       <td><b>{row.sport}{row.league?' · '+row.league:''}</b><small>{row.event}</small></td>
       <td><b>{row.selection}</b><small>{row.market}</small></td>
       <td>{odds(row.odds)}</td><td>{pct(row.simProbability)}</td><td>{pct(row.modelProb)}</td><td>{formatResearchRoi(row.expectedValue)}</td>
       <td><span className={styles.badge+' '+(strict?styles.strict:styles.fallback)}>{strict?'FILTERS MET':fallback?'FALLBACK':'REVIEW'}</span><small>{row.grade||'ungraded'} · {row.confidenceLabel||'confidence unlabeled'}</small></td>
       <td>{latest?<><span className={styles.badge+' '+severityClass}>{severity}</span><small>{latest.type||'context change'} · {latest.reason||'reason unavailable'}</small><small>{time(latest.detectedAt)}</small></>:<span className={styles.badge+' '+styles.info}>NO RETURNED FLAG</span>}</td>
      </tr>;
     })}</tbody>
    </table></div>:<div className={styles.empty}>{loading?'Loading research snapshot…':!data?'Snapshot unavailable. Refresh to try again.':'No returned live-board rows match these filters.'}</div>}
   </div>

   <aside className={styles.panel}>
    <div className={styles.panelHead}><div className="eyebrow">RESEARCH SEQUENCE</div><h3>Next events to review</h3></div>
    <div className={styles.sequence}>{report.rows.slice(0,8).map(({row,strict,contextChanges},index)=><div className={styles.sequenceRow} key={`${row.id}:${row.startTime}:${index}`}>
     <time>{time(row.startTime)}</time>
     <div><b>{row.event}</b><small>{row.selection} · {row.market}{contextChanges.length?' · '+contextChanges.length+' context flag'+(contextChanges.length===1?'':'s'):''}</small></div>
     <span className={styles.badge+' '+(strict?styles.strict:styles.fallback)}>{strict?'FILTERS MET':'REVIEW'}</span>
    </div>)}{!report.rows.length&&<div className={styles.empty}>{known?'No upcoming events in the selected snapshot filters.':loading?'Loading event sequence…':'Event sequence unavailable.'}</div>}</div>
    <div className={styles.foot}>Sequence is chronological research priority only—not a parlay, stake plan, or instruction to wager.
     <div className={styles.links}><Link href="/player-research">Player history</Link><Link href="/predictions">Prediction markets</Link><Link href="/coverage">Coverage gaps</Link></div>
    </div>
   </aside>
  </div>

  {(data?.warnings?.length||0)>0&&<div className={styles.foot}><strong>Source warnings:</strong> {data!.warnings!.slice(0,6).join(' · ')}</div>}
  <div className={styles.foot}>Manual refresh only after the initial load. Today / Next 7 days / AM / PM are filtered locally in Eastern Time. The seven-day window includes the rest of today and the following six calendar days. Snapshot and source ages update locally without additional network requests.</div>
 </section>;
}
