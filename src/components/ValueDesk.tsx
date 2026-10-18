'use client';
import {useEffect,useMemo,useState} from 'react';
type Row={rank:number;sport:string;league:string;event:string;market:string;selection:string;startTime:string;book:string;odds:number;modelWinPercent:number;breakEvenPercent:number;edgePp:number;expectedRoiPercent:number;reference:string;evidenceStatus:string};
type Board={ok:boolean;rows?:Row[];generatedAt?:string;providerDegraded?:boolean;candidateCount?:number;truncatedAtScanner?:boolean;error?:string};
const number=(n:number,d=2)=>Number.isFinite(n)?n.toFixed(d):'—';
export default function ValueDesk(){
 const [board,setBoard]=useState<Board|null>(null);
 const [busy,setBusy]=useState(true);
 const [sport,setSport]=useState('ALL');
 const [query,setQuery]=useState('');
 const [sort,setSort]=useState<'roi'|'edge'|'win'>('roi');
 const [tick,setTick]=useState(0);
 useEffect(()=>{
  let cancelled=false;
  const load=async()=>{
   setBusy(true);
   try{
    const res=await fetch('/api/value-board?limit=1000',{cache:'no-store'});
    const data=await res.json() as Board;
    if(!cancelled)setBoard(data);
   }catch{if(!cancelled)setBoard({ok:false,error:'Live board unavailable'});}
   finally{if(!cancelled)setBusy(false);}
  };
  void load();
  return()=>{cancelled=true;};
 },[tick]);
 const allRows=board?.ok?board.rows??[]:[];
 const sports=useMemo(()=>['ALL',...new Set(allRows.map(r=>r.sport))].sort((a,b)=>a==='ALL'?-1:b==='ALL'?1:a.localeCompare(b)),[allRows]);
 const visible=useMemo(()=>allRows.filter(r=>(sport==='ALL'||r.sport===sport)&&
  [r.event,r.league,r.selection,r.market,r.book].some(x=>x.toLowerCase().includes(query.toLowerCase())))
 .sort((a,b)=>sort==='roi'?b.expectedRoiPercent-a.expectedRoiPercent:sort==='edge'?b.edgePp-a.edgePp:b.modelWinPercent-a.modelWinPercent),
 [allRows,sport,query,sort]);
 return <section className="valueDesk">
 <div className="valueControls">
 <label>Sport<select value={sport} onChange={e=>setSport(e.target.value)}>{sports.map(s=><option value={s} key={s}>{s==='ALL'?'All sports':s}</option>)}</select></label>
 <label>Find market<input type="search" placeholder="Event, league, bet or sportsbook" value={query} onChange={e=>setQuery(e.target.value)}/></label>
 <label>Order by<select value={sort} onChange={e=>setSort(e.target.value)}><option value="roi">Expected ROI</option><option value="edge">Edge (pp)</option><option value="win">Win probability</option></select></label>
 <button type="button" onClick={()=>setTick(n=>n+1)} disabled={busy}>{busy?'Loading…':'Refresh quotes'}</button>
 </div>
 <div className="valueStats"><div><small>Displayed markets</small><strong>{visible.length}</strong></div><div><small>Source status</small><strong>{board?.providerDegraded?'Degraded':board?.ok?'Provisional':'Unavailable'}</strong></div><div><small>Reference method</small><strong>Market-derived</strong></div></div>
 {board?.truncatedAtScanner&&<p role="status" className="valueNotice">The scanner truncated its candidate set; this is not complete market coverage.</p>}
 <p className="valueNotice"><strong>Research only.</strong> Probabilities here are de-vigged market reference estimates, NOT independently calibrated model predictions. Prices and source freshness have not passed production verification. These rows must not trigger betting alerts.</p>
 {board?.ok&&<p className="valueCaption">Last response: {board.generatedAt?new Date(board.generatedAt).toLocaleString():'Unknown'} · Ranked across all included sports · Showing {visible.length} rows</p>}
 {board?.ok&&!visible.length?<p className="valueEmpty">No provisional value opportunities matched these filters. This does not imply that all DraftKings markets were scanned.</p>:null}
 {board&&!board.ok?<p className="valueEmpty" role="alert">Live data unavailable. {board.error||'Please retry.'} No example bets are substituted.</p>:null}
 <div className="valueTableWrap"><table className="valueTable"><thead><tr><th>#</th><th>Sport / League</th><th>Event / Selection</th><th>Book / Odds</th><th>Win %</th><th>Break-even</th><th>Edge</th><th>ROI</th><th>Evidence</th></tr></thead><tbody>{visible.map((r,i)=><tr key={r.sport+'|'+r.event+'|'+r.market+'|'+r.selection+'|'+r.book+'|'+i}><td>{i+1}</td><td><strong>{r.sport}</strong><small>{r.league}</small></td><td><strong>{r.event}</strong><small>{r.selection} · {r.market}</small></td><td><strong>{r.book}</strong><small>{r.odds>0?'+':''}{r.odds}</small></td><td>{number(r.modelWinPercent)}%</td><td>{number(r.breakEvenPercent)}%</td><td className={r.edgePp>0?'valuePositive':''}>{r.edgePp>0?'+':''}{number(r.edgePp)} pp</td><td className={r.expectedRoiPercent>0?'valuePositive':''}>{r.expectedRoiPercent>0?'+':''}{number(r.expectedRoiPercent)}%</td><td><span className="valueEvidence">Provisional</span><small>{r.reference}</small></td></tr>)}</tbody></table></div>
 </section>;
}
