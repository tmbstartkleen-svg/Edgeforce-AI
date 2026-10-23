'use client';

import {useCallback,useMemo,useState,type ChangeEvent} from 'react';
import {buildDraftKingsCoverageWorkQueue} from '@/lib/draftkings-coverage-work-queue';
import {auditOddsExportPlayerIdentities} from '@/lib/odds-export-player-identity-audit';
import {compareDraftKingsCatalogSnapshots} from '@/lib/draftkings-catalog-drift';
import type {RequiredMarket} from '@/lib/draftkings-market-gap-audit';
import type {CoverageSnapshot} from '@/lib/draftkings-coverage-continuity';
import type {AthleteDirectoryEntry} from '@/lib/draftkings-player-identity-reconciliation';

type ExportBundle={
 events:unknown[];
 expected:RequiredMarket[];
 roster?:AthleteDirectoryEntry[];
 snapshots?:CoverageSnapshot[];
 previousCatalog?:{asOf:string;sourceId:string;required:RequiredMarket[]};
 currentCatalog?:{asOf:string;sourceId:string;required:RequiredMarket[]};
};
type Report={
 gap:ReturnType<typeof buildDraftKingsCoverageWorkQueue>;
 players:ReturnType<typeof auditOddsExportPlayerIdentities>;
 drift:ReturnType<typeof compareDraftKingsCatalogSnapshots>|null;
};
const MB=12*1024*1024;
const rows=100;
function checkBundle(value:unknown):ExportBundle{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Export must be a JSON object');
 const v=value as Record<string,unknown>;
 if(!Array.isArray(v.events)||!Array.isArray(v.expected))throw Error('Expected {events:[],expected:[]}');
 if(v.events.length>500||v.expected.length>5000)throw Error('Export event or expected-catalog limit exceeded');
 if(v.roster!==undefined&&(!Array.isArray(v.roster)||v.roster.length>20000))
  throw Error('Athlete roster must be an array with at most 20,000 records');
 if(v.snapshots!==undefined&&(!Array.isArray(v.snapshots)||v.snapshots.length>24))
  throw Error('Snapshot history must contain at most 24 observations');
 return v as ExportBundle;
}
export default function DraftKingsCoverageImportStudio(){
 const [report,setReport]=useState<Report|null>(null);
 const [error,setError]=useState<string|null>(null);
 const [filename,setFilename]=useState('');
 const [processing,setProcessing]=useState(false);
 const [filter,setFilter]=useState('');
 const [priority,setPriority]=useState<'all'|'P1'|'P2'|'P3'>('all');
 const clear=useCallback(()=>{setReport(null);setError(null);setFilename('');setFilter('');setPriority('all')},[]);
 const open=useCallback(async(event:ChangeEvent<HTMLInputElement>)=>{
  const file=event.currentTarget.files?.[0];
  event.currentTarget.value='';
  if(!file)return;
  clear();
  setFilename(file.name);
  setProcessing(true);
  try{
   if(file.size>MB)throw Error('Local JSON export exceeds the 12 MB limit');
   const json=JSON.parse(await file.text()) as unknown;
   const input=checkBundle(json);
   const now=Date.now();
   // Source input never leaves this browser component: no fetch, FormData
   // request, browser storage, secrets or database mutation.
   const gap=buildDraftKingsCoverageWorkQueue(input.events,input.expected,input.snapshots||[],now,500);
   const players=auditOddsExportPlayerIdentities(input.events,input.roster||[],now);
   const drift=input.previousCatalog&&input.currentCatalog?
    compareDraftKingsCatalogSnapshots(input.previousCatalog,input.currentCatalog,now):null;
   setReport({gap,players,drift});
  }catch(cause){
   setError(cause instanceof Error?cause.message:'Unable to inspect the local export');
  }finally{setProcessing(false)}
 },[clear]);
 const visible=useMemo(()=>report?.gap.rows.filter(r=>
  (priority==='all'||r.priority===priority)&&
  (!filter||[r.sport,r.league,r.marketType,r.kind,r.eventId||'',r.playerId||'',r.reason]
   .join(' ').toLowerCase().includes(filter.toLowerCase()))).slice(0,rows)||[],[report,filter,priority]);
 return <section className="coveragePanel" aria-label="Local DraftKings coverage import" style={{marginBottom:20,padding:22}}>
  <div className="coveragePanelHead"><div><div className="eyebrow">OPERATOR WORKSPACE • LOCAL FILE ONLY</div>
   <h2>DraftKings Coverage Studio</h2></div></div>
  <p className="coverageNote">Inspect a permitted The Odds API export against an explicit expected DraftKings catalog, optional athlete roster, and historical snapshots. The JSON stays in this browser. No paid provider request, server upload or database write is performed.</p>
  <div className="coverageTools">
   <label>Choose authorized JSON export <input type="file" accept=".json,application/json" onChange={open} disabled={processing} aria-label="Choose authorized coverage JSON"/></label>
   <button type="button" onClick={clear} disabled={processing}>Clear local report</button>
  </div>
  <p className="coverageNote">Required format: <code>{'{"events":[],"expected":[],"roster":[],"snapshots":[]}'}</code>. Sport and league IDs must match; player names are provisional even when the supplied roster matches.</p>
  {processing&&<p role="status">Checking the local export…</p>}
  {error&&<p role="alert" className="coverageNote">Unable to audit {filename}: {error}</p>}
  {report&&<div aria-live="polite">
   <p className="coverageNote">Local research report: {filename}. This is not full DraftKings network coverage, a live source-authenticity certificate, or verified +EV.</p>
   <div className="coverageKpis">
    <article><small>EXPECTED MARKETS</small><strong>{report.gap.requirements}</strong><span>Supplied catalog only</span></article>
    <article><small>PRICED & MATCHED</small><strong>{report.gap.covered}</strong><span>Observed in this export</span></article>
    <article><small>MISSING</small><strong>{report.gap.missing}</strong><span>Coverage investigation tasks</span></article>
    <article><small>PROVISIONAL PLAYER JOINS</small><strong>{report.players.candidateCount}</strong><span>Zero certified IDs</span></article>
   </div>
   <p className="coverageNote">Priorities: P1 {report.gap.byPriority.P1} · P2 {report.gap.byPriority.P2} · P3 {report.gap.byPriority.P3}. History snapshots: {report.gap.historySnapshots}. Unmapped market types: {report.gap.unmappedMarkets.length}. Unresolved players: {report.players.unresolvedCount}.</p>
   {report.drift&&<p className="coverageNote">Expected-catalog changes: {report.drift.addedCount} added, {report.drift.missingCount} absent from newest snapshot. These are not confirmed sportsbook delistings.</p>}
   <div className="coverageTools">
    <input aria-label="Search gap investigations" value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Filter sport, league, market or athlete…"/>
    <select aria-label="Filter investigation priority" value={priority} onChange={e=>setPriority(e.target.value as 'all'|'P1'|'P2'|'P3')}>
     <option value="all">All priorities</option><option value="P1">P1 urgent</option><option value="P2">P2 follow-up</option><option value="P3">P3 review</option>
    </select>
   </div>
   {report.gap.queueCount===0?<p className="coverageNote">No gaps relative to the supplied catalog. This does not establish that the catalog is complete or independently authenticated.</p>:
    <div className="coverageTableWrap"><table><thead><tr><th>Priority</th><th>Sport</th><th>League</th><th>Market</th><th>Event / Player / Line</th><th>Next check</th></tr></thead>
     <tbody>{visible.map(x=><tr key={x.id}><td><strong>{x.priority}</strong></td><td>{x.sport}</td><td>{x.league}</td>
      <td>{x.marketType}</td><td>{[x.eventId,x.playerId,x.line].filter(Boolean).join(' · ')||'All events'}</td><td>{x.nextAction}</td></tr>)}</tbody>
    </table></div>}
   {report.gap.queueCount>report.gap.displayedCount&&<p className="coverageNote">Displaying the first {report.gap.displayedCount} of {report.gap.queueCount} tasks; limit the catalog or use the offline CLI for complete review.</p>}
   <p className="coverageNote">Unresolved required evidence: authenticated source entitlement, verified second independent odds feed, stable sportsbook athlete IDs, held-out calibrated forecasts and production certification.</p>
  </div>}
 </section>;
}
