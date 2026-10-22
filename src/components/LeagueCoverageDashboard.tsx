'use client';
import {useEffect,useMemo,useState} from 'react';
import {GLOBAL_SPORT_REGISTRY,SPORT_FAMILIES,sportCoverageSummary} from '@/lib/sportRegistry';
type Game={id?:string;sport?:string;league?:string;source?:string;status?:string;startTime?:string;home?:{name?:string;score?:number|null};away?:{name?:string;score?:number|null};sourceObservedAt?:string};
type Live={ok?:boolean;generatedAt?:string;games?:Game[];error?:string};
type D1Coverage={ok:boolean;asOf?:string;freshDraftKingsQuotes?:number;rowsInspected?:number;unrecognizedRows?:number;missingMarketCount?:number|null;missingReason?:string;leagues?:{sport:string;league:string;events:number;marketTypes:number;players:number;quotes:number;latestObservedAt:string}[];independentVerification?:{independentUpstreams:number;crossProviderVerified:boolean;verifiedOutcomes:number;note?:string};error?:string};
const normalizeLeague=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
// Do not turn a sport-family score into evidence for every league in that sport.
const leagueMatches=(observed:string|undefined,label:string,id:string)=>{
 const value=normalizeLeague(observed||'');
 if(!value)return false;
 return value===normalizeLeague(label)||value===normalizeLeague(id);
};
const summary=sportCoverageSummary();
export default function LeagueCoverageDashboard(){
 const [data,setData]=useState<Live|null>(null),[family,setFamily]=useState('all'),[search,setSearch]=useState(''),[refresh,setRefresh]=useState(0);
 const [token,setToken]=useState(''),[odds,setOdds]=useState<D1Coverage|null>(null),[oddsLoading,setOddsLoading]=useState(false);
 useEffect(()=>{let active=true;fetch('/api/live-scores',{cache:'no-store'}).then(async r=>{const x=await r.json();if(!r.ok)throw new Error(x.error||'Live score mesh unavailable');return x as Live}).then(x=>{if(active)setData(x)}).catch(e=>{if(active)setData({ok:false,error:e instanceof Error?e.message:'Unavailable',games:[]})});return()=>{active=false}},[refresh]);
 const loadOdds=async()=>{setOdds(null);if(!token.trim()){setOdds({ok:false,error:'Enter your authorized network token to inspect persisted odds.'});return;}setOddsLoading(true);try{const response=await fetch('/api/operations/d1-pilot/coverage',{headers:{Authorization:'Bearer '+token.trim()},cache:'no-store'});const result=await response.json() as D1Coverage;if(!response.ok||!result.ok)throw new Error(result.error||'Odds endpoint unavailable');setOdds(result);}catch(e){setOdds({ok:false,error:e instanceof Error?e.message:'Coverage request failed'});}finally{setOddsLoading(false);}};
 const filtered=useMemo(()=>GLOBAL_SPORT_REGISTRY.filter(s=>(family==='all'||s.family===family)&&(!search||[s.label,s.id,s.family,s.scope].join(' ').toLowerCase().includes(search.toLowerCase()))),[family,search]);
 const games=data?.games||[];
 const providerGroups=useMemo(()=>GLOBAL_SPORT_REGISTRY.reduce((acc,s)=>{acc[s.scoreProvider]=(acc[s.scoreProvider]||0)+1;return acc},{} as Record<string,number>),[]);
 return <section className="coverageWorkspace">
  <div className="coverageKpis">
   <article><small>REGISTERED LEAGUE FEEDS</small><strong>{summary.feeds}</strong><span>Catalog entries, not guaranteed live coverage</span></article>
   <article><small>SPORT FAMILIES</small><strong>{summary.families}</strong><span>Across pro, college and global sports</span></article>
   <article><small>LIVE GAMES OBSERVED</small><strong>{data?.ok?games.length:'—'}</strong><span>{data?.ok?'Latest live-score mesh response':'Live feed unavailable'}</span></article>
   <article><small>INDEPENDENT ODDS CORROBORATION</small><strong>{odds?.ok&&odds.independentVerification?.crossProviderVerified?odds.independentVerification.verifiedOutcomes:'Not certified'}</strong><span>{odds?.ok?'Outcomes matched by independent upstreams; not an EV model':'Authenticated D1 evidence required'}</span></article>
  </div>
  <div className="coverageTools"><input aria-label="Search leagues" placeholder="Search league, sport or scope…" value={search} onChange={e=>setSearch(e.target.value)}/><select aria-label="Filter sport family" value={family} onChange={e=>setFamily(e.target.value)}><option value="all">All sport families</option>{SPORT_FAMILIES.map(f=><option key={f} value={f}>{f}</option>)}</select><button onClick={()=>setRefresh(x=>x+1)}>Refresh live evidence</button></div>
  <section className="coveragePanel" aria-label="Persisted DraftKings odds verification" style={{marginBottom:20,padding:22}}>
   <div className="coveragePanelHead"><div><div className="eyebrow">CERTIFICATION TERMINAL</div><h2>Persisted DraftKings odds evidence</h2></div></div>
   <p className="coverageNote">Authenticated, read-only Cloudflare D1 diagnostics. Scores, configured providers and historical results are not proof of live sportsbook quotes. Your token stays in this page&apos;s memory and is not saved.</p>
   <div className="coverageTools"><input type="password" aria-label="Network authorization token" autoComplete="off" placeholder="Authorized network token" value={token} onChange={e=>setToken(e.target.value)}/><button type="button" disabled={oddsLoading} onClick={loadOdds}>{oddsLoading?'Checking odds…':'Inspect stored odds'}</button><button type="button" onClick={()=>{setToken('');setOdds(null)}}>Clear access</button></div>
   {odds&&!odds.ok&&<p role="alert" className="coverageNote">{odds.error||'Unable to verify stored odds.'}</p>}
   {odds?.ok&&<div aria-live="polite"><div className="coverageKpis">
    <article><small>FRESH DRAFTKINGS QUOTES</small><strong>{odds.freshDraftKingsQuotes??0}</strong><span>Accepted stored odds, not all available markets</span></article>
    <article><small>INDEPENDENT UPSTREAMS</small><strong>{odds.independentVerification?.independentUpstreams??0}</strong><span>Distinct fresh priced source owners</span></article>
    <article><small>CORROBORATED OUTCOMES</small><strong>{odds.independentVerification?.verifiedOutcomes??0}</strong><span>Exact bookmaker, sport, league, event, line and outcome</span></article>
    <article><small>FULL MARKET INVENTORY</small><strong>Unknown</strong><span>No independent DraftKings denominator</span></article>
   </div>
   <p className="coverageNote">D1 records checked: {odds.rowsInspected??0} · Unrecognized: {odds.unrecognizedRows??0} · Reported: {odds.asOf?new Date(odds.asOf).toLocaleString():'Unknown'} · This is not proof of executable odds or positive expected value.</p>
   {(odds.leagues?.length??0)>0?<div className="coverageTableWrap"><table><thead><tr><th>Sport</th><th>League</th><th>Events</th><th>Markets</th><th>Player IDs</th><th>Quotes</th><th>Last observed</th></tr></thead><tbody>{odds.leagues?.map(l=><tr key={l.sport+'|'+l.league}><td>{l.sport}</td><td>{l.league}</td><td>{l.events}</td><td>{l.marketTypes}</td><td>{l.players}</td><td>{l.quotes}</td><td>{new Date(l.latestObservedAt).toLocaleString()}</td></tr>)}</tbody></table></div>:<p className="coverageNote">No qualifying sportsbook observations found in this D1 response. Do not classify missing markets as unavailable.</p>}
   </div>}
  </section>
  <div className="coverageGrid">
   <article className="coveragePanel"><div className="coveragePanelHead"><div><div className="eyebrow">SOURCE MIX</div><h2>Registry by provider class</h2></div></div>{Object.entries(providerGroups).map(([k,v])=><div className="coverageBarRow" key={k}><span>{k}</span><div><i style={{width:(v/Math.max(1,summary.feeds)*100)+'%'}}/></div><b>{v}</b></div>)}<p className="coverageNote">Provider class describes the registry configuration only; it does not certify access, rights, uptime, or odds availability.</p></article>
   <article className="coveragePanel"><div className="coveragePanelHead"><div><div className="eyebrow">LIVE EVIDENCE</div><h2>Latest scoreboard scan</h2></div><button onClick={()=>setRefresh(x=>x+1)}>Refresh</button></div><div className="coverageLiveValue">{data?.ok?games.length:'—'} <span>games returned</span></div><p>{data?.generatedAt?'Fetched '+new Date(data.generatedAt).toLocaleString():data?.error||'Waiting for first response.'}</p><p className="coverageNote">Live score availability is separate from odds, player props, historical lines and model edges.</p></article>
  </div>
  <div className="coverageTableHead"><div><div className="eyebrow">LEAGUE INVENTORY</div><h2>Coverage status by league</h2></div><span>{filtered.length} entries</span></div>
  <div className="coverageTableWrap"><table><thead><tr><th>League / competition</th><th>Sport family</th><th>Scope</th><th>Configured provider</th><th>Live games</th><th>Odds / props</th><th>Status</th></tr></thead><tbody>{filtered.map(s=>{const matches=games.filter(g=>leagueMatches(g.league,s.label,s.id));const has=matches.length>0;return <tr key={s.id}><td><strong>{s.label}</strong><small>{s.id}</small></td><td>{s.family}</td><td>{s.scope}</td><td>{s.scoreProvider}</td><td>{data?.ok?matches.length:'Unknown'}</td><td><span className="coverageStatus pending">Unverified</span></td><td><span className={'coverageStatus '+(has?'partial':'pending')}>{has?'Score evidence':'Not observed'}</span></td></tr>})}</tbody></table></div>
  <p className="coverageNote">League game counts require exact normalized league labels or IDs; differing upstream league names remain unmatched rather than being assigned to an entire sport family. Odds-market status remains unverified until a bookmaker-specific scan confirms event, market, price, and timestamp.</p>
 </section>
}
