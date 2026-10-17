'use client';
import {useEffect,useMemo,useState} from 'react';
type Market={id:string;league:string;sport:string;event:string;selection:string;market:string;sourceBook?:string;sourceProviderId?:string;sourceAgeMin:number;odds:number;sourceTimestamp?:string;startTime:string};
type Payload={mode?:string;source?:string;providerId?:string;providerName?:string;error?:string;warnings?:string[];markets?:Market[]};
const MAX_AGE_MIN=30;
const reliableSource=(source?:string)=>source==='live'||source==='stored';
const validMarket=(m:Market)=>Number.isFinite(m.odds)&&m.odds!==0&&Number.isFinite(m.sourceAgeMin)&&m.sourceAgeMin>=0&&m.sourceAgeMin<=MAX_AGE_MIN&&!!m.sourceBook?.trim()&&!!m.event?.trim()&&!!m.market?.trim()&&!!m.selection?.trim();
export default function MarketEvidencePanel(){
 const [data,setData]=useState<Payload|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[revision,setRevision]=useState(0),[filter,setFilter]=useState('');
 useEffect(()=>{let alive=true;const abort=new AbortController();setLoading(true);setError('');fetch('/api/markets',{cache:'no-store',signal:abort.signal}).then(async r=>{if(!r.ok)throw new Error('Market API returned HTTP '+r.status);return await r.json() as Payload;}).then(d=>{if(alive)setData(d);}).catch(e=>{if(alive)setError(e instanceof Error?e.message:'Markets unavailable');}).finally(()=>{if(alive)setLoading(false);});return()=>{alive=false;abort.abort()};},[revision]);
 const markets=useMemo(()=>Array.isArray(data?.markets)?data.markets:[],[data]);
 const verified=useMemo(()=>reliableSource(data?.source)?markets.filter(validMarket):[],[data?.source,markets]);
 const byLeague=useMemo(()=>{const counts=new Map<string,{all:number;verified:number;books:Set<string>;kinds:Set<string>}>();for(const m of markets){const name=m.league||'Unknown league';const entry=counts.get(name)||{all:0,verified:0,books:new Set<string>(),kinds:new Set<string>()};entry.all++;if(reliableSource(data?.source)&&validMarket(m)){entry.verified++;entry.books.add(m.sourceBook!);entry.kinds.add(m.market);}counts.set(name,entry)}return [...counts].filter(([k])=>k.toLowerCase().includes(filter.toLowerCase())).sort((a,b)=>b[1].verified-a[1].verified||b[1].all-a[1].all)},[data?.source,markets,filter]);
 const books=new Set(verified.map(m=>m.sourceBook));
 return <section className="coverageWorkspace" aria-label="Bookmaker market evidence"><div className="coverageTableHead"><div><div className="eyebrow">MARKET COVERAGE AUDIT</div><h2>Observed bookmaker markets</h2></div><button onClick={()=>setRevision(x=>x+1)} disabled={loading}>{loading?'Loading…':'Refresh odds evidence'}</button></div>
 <p className="coverageNote">Eligibility: a real live or stored source, complete event/market/selection/bookmaker, numeric odds and reported age of at most {MAX_AGE_MIN} minutes. This is a coverage check, <strong>not independent price verification, a projection, or a betting recommendation.</strong></p>
 <div className="coverageKpis"><article><small>SOURCE MODE</small><strong>{loading?'Loading':data?.source||'Unavailable'}</strong><span>{data?.providerName||data?.providerId||'No reported provider'}</span></article><article><small>RETURNED MARKETS</small><strong>{loading?'—':markets.length}</strong><span>Includes stale, incomplete and demo observations</span></article><article><small>FRESH OBSERVATIONS</small><strong>{loading?'—':verified.length}</strong><span>At most {MAX_AGE_MIN} minutes old with bookmaker identification</span></article><article><small>IDENTIFIED BOOKMAKERS</small><strong>{loading?'—':books.size}</strong><span>One bookmaker is not independent multi-book validation</span></article></div>
 {error&&<p role="alert" className="coverageNote">Market feed error: {error}</p>}
 {data?.error&&<p role="alert" className="coverageNote">Upstream: {data.error}</p>}
 {data?.warnings?.slice(0,5).map((w,i)=><p key={i} className="coverageNote">Feed warning: {w}</p>)}
 <div className="coverageTools"><input aria-label="Filter market leagues" placeholder="Filter leagues with market evidence…" value={filter} onChange={e=>setFilter(e.target.value)}/></div>
 <div className="coverageTableWrap"><table><thead><tr><th>Reported league</th><th>Returned</th><th>Fresh complete</th><th>Bookmakers</th><th>Market types</th><th>Evidence status</th></tr></thead><tbody>{byLeague.map(([league,row])=><tr key={league}><td><strong>{league}</strong></td><td>{row.all}</td><td>{row.verified}</td><td>{row.books.size}</td><td>{row.kinds.size}</td><td><span className={'coverageStatus '+(row.verified?'partial':'pending')}>{row.verified?'Fresh source reported':'Not verified'}</span></td></tr>)}</tbody></table></div>
 {!loading&&!byLeague.length&&<p className="coverageNote">No sportsbook markets are currently available for this filter. Absence of data is not proof the league has no events or betting markets.</p>}
 <p className="coverageNote">Counts cover only this API response, not every DraftKings league or all books. A sportsbook listing is not evidence of a positive edge. Probability, price comparison, source independence and settlement still require separate checks.</p>
 </section>;
}
