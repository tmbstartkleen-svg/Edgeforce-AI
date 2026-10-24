'use client';
import {useMemo,useState} from 'react';
import {comparePredictionContracts} from '@/lib/intelligence-core/prediction-arbitrage-calculator.mjs';

const usd=(v:number|null)=>v===null||!Number.isFinite(v)?'N/A':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(v);
const percent=(v:number|null)=>v===null||!Number.isFinite(v)?'N/A':v.toFixed(2)+'%';
export default function PredictionArbitrageStudio(){
 const [yesExchange,setYesExchange]=useState('Kalshi');
 const [noExchange,setNoExchange]=useState('Polymarket');
 const [yes,setYes]=useState('44');const [no,setNo]=useState('52');
 const [size,setSize]=useState('100');const [yesFee,setYesFee]=useState('0');const [noFee,setNoFee]=useState('0');
 const [otherFee,setOtherFee]=useState('0');const [yesLiquidity,setYesLiquidity]=useState('0');const [noLiquidity,setNoLiquidity]=useState('0');
 const [resolution,setResolution]=useState('2028-12-31');const [matched,setMatched]=useState(false);
 const [threshold,setThreshold]=useState('2');const [alertsEnabled,setAlertsEnabled]=useState(false);
 const [watched,setWatched]=useState<{event:string;roi:number;at:string}[]>([]);
 const [event,setEvent]=useState('');
 const [catalog,setCatalog]=useState<Catalog|null>(null);const [catalogError,setCatalogError]=useState('');const [catalogLoading,setCatalogLoading]=useState(false);const [query,setQuery]=useState('');
 async function loadPublicCatalog(){if(!operatorToken)return;setCatalogLoading(true);setCatalogError('');
  try{const response=await fetch('/api/operations/prediction-catalog',{headers:{authorization:'Bearer '+operatorToken},cache:'no-store'});
   const data:Catalog=await response.json();if(!response.ok||!data.ok){setCatalogError(data.error||'Catalog unavailable');setCatalog(null)}else setCatalog(data);
  }catch{setCatalogError('Market discovery is unreachable.');setCatalog(null)}finally{setCatalogLoading(false)}
 }
 const filtered=(catalog?.markets||[]).filter(m=>(m.title+' '+m.exchange).toLowerCase().includes(query.toLowerCase()));
 const isNumber=(s:string)=>s.trim()!==''&&Number.isFinite(Number(s));
 const valid=[yes,no,size,yesFee,noFee,otherFee,yesLiquidity,noLiquidity].every(isNumber);
 const quote=useMemo(()=>{
  if(!valid)return null;
  try{return comparePredictionContracts({yesCents:Number(yes),noCents:Number(no),contracts:Number(size),
   yesFeeCents:Number(yesFee),noFeeCents:Number(noFee),extraFeeCents:Number(otherFee),
   yesAvailable:Number(yesLiquidity),noAvailable:Number(noLiquidity),expiresAt:resolution?resolution+'T23:59:59Z':null,settlementMatched:matched});}
  catch{return null}
 },[yes,no,size,yesFee,noFee,otherFee,yesLiquidity,noLiquidity,resolution,matched,valid]);
 const canAlert=quote?.status==='MATHEMATICALLY_POSITIVE_UNVERIFIED_FILLS'&&quote?.netRoiPct!==null&&quote.netRoiPct>=Number(threshold);
 const pushAlert=()=>{if(canAlert&&quote?.netRoiPct!=null)setWatched(x=>[{event:event||'Unnamed comparison',roi:quote.netRoiPct!,at:new Date().toLocaleString()},...x].slice(0,10));};
 return <div className="efops-panel">
  <h2>Prediction Market Arbitrage Studio</h2>
  <section className="efops-panel"><div className="efops-panel-head"><h2>Live public market discovery</h2><button className="efops-action" disabled={catalogLoading||!operatorToken} onClick={()=>void loadPublicCatalog()}>{catalogLoading?"Loading…":"Load exchange catalogs"}</button></div><p>Browse a bounded set of currently listed Kalshi and Polymarket contracts, including future years where available. These are public catalog listings, <b>not certified tradeable arbitrage</b>; do not use indicative bid/ask snapshots as executable prices.</p>{catalogError&&<p className="efops-error" role="alert">{catalogError}</p>}{catalog&&<><p>Observed: {catalog.asOf?new Date(catalog.asOf).toLocaleString():"Unavailable"} · Kalshi: {catalog.upstreamStatus?.Kalshi||"Unknown"} · Polymarket: {catalog.upstreamStatus?.Polymarket||"Unknown"} · Bounded sample: up to 200 per exchange</p><label className="efops-field">Search title or exchange<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search markets, seasons or future years"/></label><div className="efops-tablebox"><table><thead><tr><th>Exchange</th><th>Market</th><th>Closing date</th><th>Indicative YES ask</th><th>Open</th></tr></thead><tbody>{filtered.slice(0,100).map(m=><tr key={m.exchange+m.id}><td>{m.exchange}</td><td>{m.title}</td><td>{m.closesAt?new Date(m.closesAt).toLocaleDateString():"Unknown"}</td><td>{m.yesAskCents===null?"Unavailable":m.yesAskCents.toFixed(2)+"¢"}</td><td><a href={m.url} target="_blank" rel="noopener noreferrer">Exchange</a></td></tr>)}</tbody></table>{!filtered.length&&<p>No matching markets in the bounded catalog sample.</p>}</div></>}</section>
  <p>Compare buying YES on one exchange against buying NO on the other. Enter the current executable <b>ask prices in cents</b>, not headline probabilities. The example values below are hypothetical until you replace them with observed quotes.</p>
  <div className="efops-grid">
   <div className="efops-stat"><span>Combined price</span><strong>{valid?(Number(yes)+Number(no)).toFixed(2)+'¢':'—'}</strong><small>Before fees</small></div>
   <div className="efops-stat"><span>Net profit</span><strong>{usd(quote?.netProfit??null)}</strong><small>Assumes full paired fills</small></div>
   <div className="efops-stat"><span>Net ROI</span><strong>{percent(quote?.netRoiPct??null)}</strong><small>After entered fees</small></div>
   <div className="efops-stat"><span>Capital lock</span><strong>{quote?.daysUntilResolution==null?'—':Math.ceil(quote.daysUntilResolution)+' days'}</strong><small>Resolution date, not guaranteed payout date</small></div>
  </div>
  <div className="efops-grid">
   <label className="efops-field">Market / contract pair<input value={event} onChange={e=>setEvent(e.target.value)} placeholder="Exact matching market title"/></label>
   <label className="efops-field">YES exchange<select value={yesExchange} onChange={e=>setYesExchange(e.target.value)}><option>Kalshi</option><option>Polymarket</option></select></label>
   <label className="efops-field">NO exchange<select value={noExchange} onChange={e=>setNoExchange(e.target.value)}><option>Polymarket</option><option>Kalshi</option></select></label>
   <label className="efops-field">Resolution date<input type="date" value={resolution} onChange={e=>setResolution(e.target.value)}/></label>
   {([{label:'YES ask (¢)',value:yes,set:setYes},{label:'NO ask (¢)',value:no,set:setNo},{label:'Contract pairs',value:size,set:setSize},{label:'YES available contracts',value:yesLiquidity,set:setYesLiquidity},{label:'NO available contracts',value:noLiquidity,set:setNoLiquidity},{label:'YES fees, total (¢)',value:yesFee,set:setYesFee},{label:'NO fees, total (¢)',value:noFee,set:setNoFee},{label:'Other costs, total (¢)',value:otherFee,set:setOtherFee}] as const).map(f=><label key={f.label} className="efops-field">{f.label}<input type="number" min="0" step="any" value={f.value} onChange={e=>f.set(e.target.value)}/></label>)}
  </div>
  <label className="efops-check"><input type="checkbox" checked={matched} onChange={e=>setMatched(e.target.checked)}/> I independently verified both contracts have identical resolution criteria, exclusivity, payout unit and timing.</label>
  <div className="efops-grid">
   <div className="efops-stat"><span>Total cost including fees</span><strong>{usd(quote?.cost??null)}</strong></div>
   <div className="efops-stat"><span>Payout if both positions settle oppositely</span><strong>{usd(quote?.payout??null)}</strong></div>
   <div className="efops-stat"><span>Maximum paired depth</span><strong>{quote?.maxFills??'—'}</strong></div>
   <div className="efops-stat"><span>Illustrative annualized ROI</span><strong>{percent(quote?.illustrativeAnnualizedRoiPct??null)}</strong><small>Not a forecast; assumes hypothetical reinvestment</small></div>
  </div>
  {quote?.barriers.length?<p className="efops-error">Not eligible: {quote.barriers.join(' · ').replaceAll('_',' ')}</p>:<p>Mathematically positive from entered inputs, but executable prices, fees, fillability and platform access remain independently unverified.</p>}
  <div className="efops-panel-head"><h2>In-dashboard alert screening</h2><label className="efops-field">Minimum net ROI (%)<input type="number" value={threshold} min="0" step=".1" onChange={e=>setThreshold(e.target.value)}/></label></div>
  <label className="efops-check"><input type="checkbox" checked={alertsEnabled} onChange={e=>setAlertsEnabled(e.target.checked)}/> Enable on-screen screening for this comparison</label>
  <p>Alerts here require the dashboard to be open and a user-supplied price review. Background push, SMS, and continuous exchange order-book polling are <b>not enabled</b>. A threshold hit is not a guaranteed arbitrage fill.</p>
  <button className="efops-action" disabled={!alertsEnabled||!canAlert} onClick={pushAlert}>Evaluate and record current alert</button>
  {watched.length>0&&<div className="efops-tablebox"><table><thead><tr><th>Market</th><th>Entered ROI</th><th>Evaluated</th></tr></thead><tbody>{watched.map((a,i)=><tr key={i}><td>{a.event}</td><td>{percent(a.roi)}</td><td>{a.at}</td></tr>)}</tbody></table></div>}
  <p className="efops-disclosure">Manual inputs are examples, not live exchange data. Cross-venue trades can lose money through differing settlement, fees, regional restrictions, unfilled legs, or market suspension. Longer maturities tie up capital and annualization is illustrative only.</p>
 </div>;
}
