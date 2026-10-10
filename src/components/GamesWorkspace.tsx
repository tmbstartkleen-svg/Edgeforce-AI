'use client';
import {useEffect,useMemo,useState} from 'react';
import {ESPN_SCOREBOARD_FEEDS} from '@/lib/sportRegistry';
import type {ScheduleGame,ScheduleResult} from '@/lib/gameSchedule';
const batches=Math.ceil(ESPN_SCOREBOARD_FEEDS.length/7);
const time=(value:string)=>new Date(value).toLocaleString('en-US',{timeZone:'America/New_York',weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
const price=(n:number)=>n>0?`+${n}`:String(n);
export default function GamesWorkspace(){
 const [range,setRange]=useState(1),[sport,setSport]=useState('ALL'),[search,setSearch]=useState(''),[results,setResults]=useState<ScheduleResult[]>([]),[loading,setLoading]=useState(true),[progress,setProgress]=useState({done:0,total:batches}),[failed,setFailed]=useState(0),[refresh,setRefresh]=useState(0),[status,setStatus]=useState('ALL');
 useEffect(()=>{
  let cancelled=false;const controller=new AbortController();
  const jobs=Array.from({length:range},(_,day)=>Array.from({length:sport==='ALL'?batches:1},(_,batch)=>({day,batch}))).flat();
  let cursor=0,done=0,failures=0;const collected:ScheduleResult[]=[];
  // Three bounded invocations at a time. Each server request uses at most eight external calls.
  const run=async()=>{
   setLoading(true);setResults([]);setFailed(0);setProgress({done:0,total:jobs.length});
   await Promise.all(Array.from({length:Math.min(3,jobs.length)},async()=>{
    while(!cancelled&&cursor<jobs.length){
     const {day,batch}=jobs[cursor++];
     try{
      const response=await fetch(`/api/game-schedule?day=${day}&batch=${batch}${sport==='ALL'?'':'&sport='+encodeURIComponent(sport)}`,{signal:controller.signal});
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const result:ScheduleResult=await response.json();
      if(!cancelled){collected.push(result);setResults([...collected]);}
     }catch{if(!cancelled)setFailed(++failures);}
     if(!cancelled)setProgress({done:++done,total:jobs.length});
    }
   }));
   if(!cancelled)setLoading(false);
  };
  void run();const timer=window.setInterval(()=>setRefresh(n=>n+1),120000);
  return ()=>{cancelled=true;controller.abort();window.clearInterval(timer);};
 },[range,sport,refresh]);
 const games=useMemo(()=>[...new Map(results.flatMap(r=>r.games).map(g=>[g.id,g])).values()].sort((a,b)=>a.startTime.localeCompare(b.startTime)),[results]);
 const visible=games.filter(g=>(status==='ALL'||g.state===status)&&`${g.home} ${g.away} ${g.sport}`.toLowerCase().includes(search.toLowerCase()));
 const quoted=games.filter(g=>g.quotes.length>0).length;
 const failedFeeds=results.flatMap(r=>r.feeds.filter(f=>!f.ok||f.error||f.truncated).map(f=>`${r.date} · ${f.label}: ${f.error||'Result limit reached'}`));
 const grouped=new Map<string,ScheduleGame[]>();
 for(const game of visible){const key=new Date(game.startTime).toLocaleDateString('en-US',{timeZone:'America/New_York',weekday:'long',month:'long',day:'numeric'});grouped.set(key,[...(grouped.get(key)||[]),game]);}
 return <section id="games" className="gamesWorkspace" aria-label="Games and schedules">
  <div className="gamesHeading"><div><span className="gamesKicker">THE SPORTS BOARD</span><h2>Games & schedules</h2><p>Browse schedules first, then the available game lines. All times Eastern.</p></div><button className="gamesRefresh" onClick={()=>setRefresh(n=>n+1)} disabled={loading}>↻ Refresh</button></div>
  <div className="gamesControls"><div className="gamesRange"><button aria-pressed={range===1} onClick={()=>setRange(1)}>Today</button><button aria-pressed={range===7} onClick={()=>setRange(7)}>Next 7 days</button></div><select aria-label="Schedule sport" value={sport} onChange={e=>setSport(e.target.value)}><option value="ALL">All supported leagues</option>{ESPN_SCOREBOARD_FEEDS.map(f=><option key={f.id} value={f.id}>{f.label}</option>)}</select><select aria-label="Game status" value={status} onChange={e=>setStatus(e.target.value)}><option value="ALL">All games</option><option value="pre">Upcoming</option><option value="in">Live</option><option value="post">Final</option></select><input aria-label="Search teams" placeholder="Search teams or leagues" value={search} onChange={e=>setSearch(e.target.value)}/></div>
  <div className="gamesSummary" aria-live="polite"><div><b>{games.length}</b><span>games loaded{loading?' so far':''}</span></div><div><b>{quoted}</b><span>with game lines</span></div><div><b>{games.length-quoted}</b><span>without quoted odds</span></div><div><b>{loading?`${progress.done}/${progress.total}`:failedFeeds.length+failed?'Partial':'Updated'}</b><span>{loading?'schedule batches loaded':'feed coverage'}</span></div></div>
  <details className="gamesCoverage"><summary>Coverage and missing markets{failedFeeds.length+failed?` · ${failedFeeds.length+failed} warnings`:''}</summary><p>Schedules cover {ESPN_SCOREBOARD_FEEDS.length} ESPN leagues, independently of the ranked picks. A game without prices stays visible. This feed supplies game lines where published; it does not provide a complete player-prop catalogue. Tennis, table tennis and leagues outside this list still need a verified schedule source.</p>{failed>0&&<p>{failed} requests failed. Refresh to retry.</p>}{failedFeeds.map((message,i)=><p key={i}>{message}</p>)}</details>
  {loading&&<div className="gamesLoading" role="status">Loading {range===7?'the next seven days':'today’s schedule'}… Matchups appear as each feed returns.</div>}
  {!loading&&!visible.length&&<div className="gamesEmpty">{failed||failedFeeds.length?'Some schedules could not be loaded. See coverage details or try Refresh.':'No games match these filters in the returned schedules.'}</div>}
  {[...grouped].map(([date,rows])=><section className="gamesDay" key={date}><h3>{date}<span>{rows.length} games</span></h3><div className="gamesGrid">{rows.map(game=><article className="matchupCard" key={game.id}><div className="matchupMeta"><span>{game.sport}</span><b className={game.state==='in'?'gameLive':''}>{game.state==='pre'?time(game.startTime):game.status}</b></div><div className="matchupTeams"><div><strong>{game.away}</strong>{game.state!=='pre'&&<b>{game.awayScore}</b>}</div><div><strong>{game.home}</strong>{game.state!=='pre'&&<b>{game.homeScore}</b>}</div></div><div className="matchupVenue">{game.venue||'Venue to be announced'}</div><div className="matchupPrices">{game.quotes.length>0?['h2h','spreads','totals'].map(m=><div key={m}><small>{m==='h2h'?'Moneyline':m==='spreads'?'Spread':'Total'}</small>{game.quotes.filter(q=>q.market===m).map((q,i)=><div className="gameQuote" key={i}><span>{q.selection}</span><b>{price(q.odds)}</b></div>)}{!game.quotes.some(q=>q.market===m)&&<span className="noQuote">Not quoted</span>}</div>):<div className="noGameOdds">Odds not supplied · game remains on the schedule</div>}</div>{game.quotes.length>0&&<footer>{[...new Set(game.quotes.map(q=>q.bookmaker))].join(', ')} via ESPN · quoted prices, not recommendations</footer>}</article>)}</div></section>)}
 </section>;
}
