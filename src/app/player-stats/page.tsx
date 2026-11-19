'use client';

import {useEffect,useMemo,useState} from 'react';

type Player={id:string;name:string;sport?:string;team?:string;position?:string;games?:number};
type Game={event_id?:string;stat_date?:string;stats?:Record<string,unknown>;source?:string};
const num=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?v:typeof v==='string'&&v.trim()!==''&&Number.isFinite(Number(v))?Number(v):null;
const label=(key:string)=>key.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());

export default function PlayerStatsExplorer(){
 const [players,setPlayers]=useState<Player[]>([]);
 const [query,setQuery]=useState('');
 const [sport,setSport]=useState('');
 const [selected,setSelected]=useState<Player|null>(null);
 const [history,setHistory]=useState<Game[]>([]);
 const [windowSize,setWindowSize]=useState(10);
 const [loading,setLoading]=useState(false);
 const [source,setSource]=useState('');
 const [error,setError]=useState('');
 useEffect(()=>{
  let cancelled=false;
  fetch('/api/players?limit=500',{cache:'no-store'})
   .then(r=>{if(!r.ok)throw Error('Player directory unavailable');return r.json()})
   .then(d=>{if(!cancelled){setPlayers(Array.isArray(d.players)?d.players:[]);setSource(d.source||'unknown')}})
   .catch(e=>{if(!cancelled)setError(String(e.message||e))});
  return ()=>{cancelled=true};
 },[]);
 useEffect(()=>{
  if(!selected){setHistory([]);return}
  let cancelled=false;
  setLoading(true);setError('');
  fetch('/api/player/'+encodeURIComponent(selected.id),{cache:'no-store'})
   .then(r=>{if(!r.ok)throw Error('Player history unavailable');return r.json()})
   .then(d=>{if(!cancelled){setHistory(Array.isArray(d.history)?d.history:[]);setSource(d.source||'unknown')}})
   .catch(e=>{if(!cancelled)setError(String(e.message||e))})
   .finally(()=>{if(!cancelled)setLoading(false)});
  return ()=>{cancelled=true};
 },[selected]);
 const sports=useMemo(()=>Array.from(new Set(players.map(p=>p.sport).filter((s):s is string=>Boolean(s)))).sort(),[players]);
 const visible=useMemo(()=>players.filter(p=>(!sport||p.sport===sport)&&[p.name,p.team,p.position].some(v=>(v||'').toLowerCase().includes(query.toLowerCase()))).slice(0,60),[players,sport,query]);
 const recent=history.slice(0,windowSize);
 const stats=useMemo(()=>{
  const values=new Map<string,number[]>();
  for(const game of recent)for(const [key,raw] of Object.entries(game.stats||{})){
   const value=num(raw);if(value===null)continue;
   values.set(key,[...(values.get(key)||[]),value]);
  }
  return Array.from(values.entries()).map(([key,items])=>({key,average:items.reduce((a,b)=>a+b,0)/items.length,count:items.length})).sort((a,b)=>a.key.localeCompare(b.key));
 },[history,windowSize]);
 return <main style={{maxWidth:1150,margin:'0 auto',padding:24,color:'inherit'}}>
  <h1>Player Stats Explorer</h1>
  <p>Search players, inspect game logs, and compare recent per-game averages. All figures come from the EdgeForce player warehouse; no synthetic stats are shown.</p>
  <div style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:18}}>
   <input aria-label="Search players" placeholder="Search player or team" value={query} onChange={e=>setQuery(e.target.value)} style={{padding:10,flex:2,minWidth:200,color:'#111'}}/>
   <select aria-label="Sport" value={sport} onChange={e=>setSport(e.target.value)} style={{padding:10,flex:1,minWidth:130,color:'#111'}}><option value="">All sports</option>{sports.map(s=><option key={s}>{s}</option>)}</select>
  </div>
  <p style={{fontSize:13}}>Data source: {source||'loading'} {source==='demo'?'— demo data; not verified live statistics':''}</p>
  {error&&<p role="alert" style={{color:'#dc2626'}}>{error}</p>}
  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',gap:24}}>
   <section><h2>Players</h2><div style={{maxHeight:560,overflow:'auto'}}>{visible.map(p=><button key={p.id} onClick={()=>setSelected(p)} style={{display:'block',width:'100%',textAlign:'left',padding:12,marginBottom:6,border:'1px solid #8885',borderRadius:8,background:selected?.id===p.id?'#166534':'transparent',color:'inherit',cursor:'pointer'}}><strong>{p.name}</strong><div style={{fontSize:13}}>{[p.team,p.sport,p.position].filter(Boolean).join(' · ')}</div></button>)}{!visible.length&&<p>No matching players in the loaded directory.</p>}</div></section>
   <section><h2>{selected?selected.name:'Select a player'}</h2>{selected&&<><p>{[selected.team,selected.sport,selected.position].filter(Boolean).join(' · ')}</p><label>Sample window <select value={windowSize} onChange={e=>setWindowSize(Number(e.target.value))} style={{padding:8,color:'#111'}}>{[5,10,20,50].map(n=><option key={n} value={n}>Last {n} games</option>)}</select></label>{loading?<p>Loading game logs…</p>:!history.length?<p>No verified game logs available for this player.</p>:<><p>Available games in window: {recent.length}. Each average uses only games where that statistic was recorded.</p><div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr><th style={{textAlign:'left'}}>Statistic</th><th>Average</th><th>Games</th></tr></thead><tbody>{stats.map(s=><tr key={s.key}><td style={{padding:8,borderBottom:'1px solid #8885'}}>{label(s.key)}</td><td style={{textAlign:'center'}}>{s.average.toFixed(2)}</td><td style={{textAlign:'center'}}>{s.count}</td></tr>)}</tbody></table></div><h3>Recent games</h3><div style={{maxHeight:220,overflow:'auto'}}>{recent.map((g,i)=><div key={g.event_id||i} style={{padding:8,borderBottom:'1px solid #8885'}}>{g.stat_date?new Date(g.stat_date).toLocaleDateString():'Unknown date'} · {g.source||'Unknown source'} · {Object.keys(g.stats||{}).length} stats</div>)}</div></>}</>}</section>
  </div>
 </main>;
}
