'use client';
import {useState} from 'react';
type Kind='MARKET_OBSERVATION'|'MODEL_FORECAST'|'PLAYER_STAT';
type Stream={recordType:Kind;lastSourceId:string;copiedRecords:string;attemptedBatches:string;lastBatchAt:string|null;nextAllowedAt:string};
type Status={ok:boolean;status?:string;writesEnabled?:boolean;playerArchiveEnabled?:boolean;sourceAllowlistConfigured?:boolean;streams?:Stream[]};
type ArchiveRecord={id:string;eventId:string;eventTime:string;sport:string;league:string|null;recordType:Kind;
 sourceProvider:string;sourceObservedAt:string|null;firstArchivedAt:string;
 subject:string;market:string|null;selection:string|null;bookmaker:string|null;odds:string|null;
 modelProbability:string|null;officialScoreVerified:false;executionEligible:false};
type Records={ok:boolean;status?:string;records?:ArchiveRecord[];nextBefore?:string|null;warning?:string};
type SyncResult={ok:boolean;status?:string;kind?:Kind;inserted?:number;scanned?:number;nextAllowedAt?:string};

const kinds:[Kind,string][]=[
 ['MARKET_OBSERVATION','Historic odds'],['MODEL_FORECAST','Model history'],['PLAYER_STAT','Player stats']
];
const date=(v:string|null|undefined)=>v&&Number.isFinite(Date.parse(v))?new Date(v).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'Not recorded';
const number=(v:string|null|undefined)=>v!==null&&v!==undefined&&Number.isFinite(Number(v))?Number(v).toLocaleString():'—';
export default function SportsArchiveWarehouse({token,sport}:{token:string;sport:string}){
 const [kind,setKind]=useState<Kind>('MARKET_OBSERVATION');
 const [status,setStatus]=useState<Status|null>(null);
 const [records,setRecords]=useState<Records|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [result,setResult]=useState<SyncResult|null>(null);
 const auth={Authorization:'Bearer '+token};
 const changeKind=(v:Kind)=>{setKind(v);setRecords(null);setError('');setResult(null)};
 const readStatus=async()=>{
  setBusy(true);setError('');
  try{
   const res=await fetch('/api/network/v1/archive?view=status',{cache:'no-store',headers:auth});
   const data=await res.json() as Status;
   if(!res.ok)throw new Error(data.status||'Archive status unavailable');
   setStatus(data);
  }catch(e){setError(e instanceof Error?e.message:'Archive status unavailable')}
  finally{setBusy(false)}
 };
 const readRecords=async(before?:string)=>{
  setBusy(true);setError('');
  try{
   const params=new URLSearchParams({view:'records',kind,limit:'30',...(sport==='ALL'?{}:{sport}),
    ...(before?{before}:{})});
   const res=await fetch('/api/network/v1/archive?'+params,{cache:'no-store',headers:auth});
   const data=await res.json() as Records;
   if(!res.ok)throw new Error(data.status||'Archive records unavailable');
   setRecords(data);
  }catch(e){setError(e instanceof Error?e.message:'Archive unavailable')}
  finally{setBusy(false)}
 };
 const archive=async()=>{
  if(busy||!status?.writesEnabled)return;
  setBusy(true);setResult(null);setError('');
  try{
   const res=await fetch('/api/network/v1/archive/sync',{
    method:'POST',cache:'no-store',headers:{...auth,'Content-Type':'application/json'},
    body:JSON.stringify({kind})
   });
   const data=await res.json() as SyncResult;
   if(!res.ok)throw new Error(data.status||'Archive batch unavailable');
   setResult(data);
   // Operator must request refreshed coverage explicitly; no looped backfill.
  }catch(e){setError(e instanceof Error?e.message:'Archive batch unavailable')}
  finally{setBusy(false)}
 };
 return <section className="efWarehouse" aria-label="Private historical warehouse">
  <div className="efWarehouseHead"><div>
   <span className="efKicker">EDGEFORCE NETWORK / DURABLE HISTORY / V208</span>
   <h3>Historical data warehouse</h3>
   <p>Permanent research records from permitted sources, with preserved provider identity and ingestion timestamps. No invented games or future results.</p>
  </div><span className="efWarehouseTag">PRIVATE · SOURCE-GATED</span></div>
  <div className="efWarehouseActions">
   <button type="button" onClick={()=>void readStatus()} disabled={busy||token.length!==64}>Check archive health</button>
   {status&&<span>{status.writesEnabled?'Controlled archive writes enabled':'Archive writes disabled by operator'}</span>}
  </div>
  {status&&<div className="efWarehouseCounters">{(status.streams||[]).map(s=><div key={s.recordType}>
   <small>{s.recordType.replaceAll('_',' ')}</small><b>{number(s.copiedRecords)}</b><span>Stored rows · last {date(s.lastBatchAt)}</span>
  </div>)}</div>}
  <div className="efWarehouseToolbar"><div role="group" aria-label="Archive record type">
   {kinds.map(([k,title])=><button type="button" key={k} aria-pressed={kind===k} onClick={()=>changeKind(k)}>{title}</button>)}
  </div><button type="button" disabled={busy||token.length!==64} onClick={()=>void readRecords()}>Read saved records</button></div>
  {status?.writesEnabled&&<div className="efWarehouseBackfill">
   <p>Backfill up to 80 more previously collected {kind.toLowerCase().replaceAll('_',' ')} records. This is a manual, database-only operation with a shared one-minute cooldown.</p>
   <button type="button" disabled={busy||token.length!==64||
    kind!=='MODEL_FORECAST'&&!status.sourceAllowlistConfigured||
    kind==='PLAYER_STAT'&&!status.playerArchiveEnabled}
    onClick={()=>void archive()}>Archive next 80 (maximum)</button>
  </div>}
  {result&&<p role="status" className="efWarehouseNotice">{result.status} · {result.inserted??0} newly archived from {result.scanned??0} examined · next eligible at {date(result.nextAllowedAt)}.</p>}
  {error&&<p role="alert" className="efChronicleAlert">{error}</p>}
  {records&&<div className="efWarehouseRecords">
   <p>{records.records?.length||0} private {kind.toLowerCase().replaceAll('_',' ')} records retrieved. History depends on actual ingestion and permitted retention.</p>
   {(records.records||[]).map(r=><article key={r.id}>
    <div><strong>{r.sport} · {r.subject}</strong><small>{date(r.eventTime)}</small></div>
    <p>{r.recordType.replaceAll('_',' ')} · {r.sourceProvider} · {r.market||'event data'}</p>
    <small>Price {r.odds??'unavailable'} · Model probability {r.modelProbability??'unavailable'} · Archived {date(r.firstArchivedAt)} · Source observation {date(r.sourceObservedAt)}</small>
   </article>)}
   {records.nextBefore&&<button type="button" disabled={busy} onClick={()=>void readRecords(records.nextBefore||undefined)}>Next archived records</button>}
   {!records.records?.length&&<p>Nothing has been archived in this category yet. That means no stored history, not a lack of actual games.</p>}
  </div>}
  <p className="efWarehouseFooter">This warehouse can grow as actual records become available. It is not an unlimited provider, historical feed subscription, live betting service, or officially certified sports-results database. Provider redistribution and retention rights still apply.</p>
 </section>;
}
