'use client';
import {useState} from 'react';
type Offer={priceCents:number;size:number}|null;
type Review={ok:boolean;error?:string;asOf?:string;warnings?:string[];pairs?:{kalshiYesPolyNo:{kalshiYesAsk:Offer;polyNoAsk:Offer};polyYesKalshiNo:{polyYesAsk:Offer;kalshiNoAsk:Offer}};notes?:string[]};
const printed=(v:Offer)=>v?v.priceCents.toFixed(2)+'¢ / '+v.size.toLocaleString()+' contracts':'No verified book level';
export default function PredictionOrderbookReview({operatorToken}:{operatorToken:string}){
 const [ticker,setTicker]=useState(''),[yesToken,setYesToken]=useState(''),[noToken,setNoToken]=useState('');
 const [result,setResult]=useState<Review|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const load=async()=>{
  if(!operatorToken)return;setBusy(true);setError('');
  try{const qs=new URLSearchParams({kalshi:ticker.trim(),polyYes:yesToken.trim(),polyNo:noToken.trim()});
   const r=await fetch('/api/operations/prediction-orderbooks?'+qs.toString(),{headers:{authorization:'Bearer '+operatorToken},cache:'no-store'});
   const data:Review=await r.json();
   if(!r.ok||!data.ok){setError(data.error||'Order-book comparison unavailable');setResult(null)}
   else setResult(data);
  }catch{setError('Cannot reach the exchange order-book review service');setResult(null)}finally{setBusy(false)}
 };
 const p=result?.pairs;
 const sum=(a:Offer,b:Offer)=>a&&b?(a.priceCents+b.priceCents).toFixed(2)+'¢':'Not priceable';
 return <section className="efops-panel">
  <h2>Exchange order-book comparison</h2>
  <p>Look up an exact Kalshi ticker alongside both Polymarket outcome token IDs. These are publicly observed book levels; the contracts are <b>not automatically matched</b> and fills are not guaranteed. No trade is placed.</p>
  <div className="efops-grid">
   <label className="efops-field">Kalshi market ticker<input value={ticker} onChange={e=>setTicker(e.target.value)} placeholder="KXEVENT-..." autoComplete="off"/></label>
   <label className="efops-field">Polymarket YES token ID<input value={yesToken} onChange={e=>setYesToken(e.target.value)} placeholder="Numeric token identifier" autoComplete="off"/></label>
   <label className="efops-field">Polymarket NO token ID<input value={noToken} onChange={e=>setNoToken(e.target.value)} placeholder="Numeric token identifier" autoComplete="off"/></label>
  </div>
  <button className="efops-action" onClick={()=>void load()} disabled={busy||!ticker||!yesToken||!noToken||!operatorToken}>{busy?'Reviewing order books…':'Review both exchange books'}</button>
  {error&&<p className="efops-error" role="alert">{error}</p>}
  {result&&<><p>Received {result.asOf?new Date(result.asOf).toLocaleString():'unknown'} · Partial-book warnings: {result.warnings?.length?result.warnings.join(', '):'None from transport'}</p>
   <div className="efops-tablebox"><table><thead><tr><th>Pair</th><th>First observed ask / depth</th><th>Second observed ask / depth</th><th>Combined quoted cost</th></tr></thead><tbody>
    <tr><td>Kalshi YES + Polymarket NO</td><td>{printed(p?.kalshiYesPolyNo.kalshiYesAsk??null)}</td><td>{printed(p?.kalshiYesPolyNo.polyNoAsk??null)}</td><td>{sum(p?.kalshiYesPolyNo.kalshiYesAsk??null,p?.kalshiYesPolyNo.polyNoAsk??null)}</td></tr>
    <tr><td>Polymarket YES + Kalshi NO</td><td>{printed(p?.polyYesKalshiNo.polyYesAsk??null)}</td><td>{printed(p?.polyYesKalshiNo.kalshiNoAsk??null)}</td><td>{sum(p?.polyYesKalshiNo.polyYesAsk??null,p?.polyYesKalshiNo.kalshiNoAsk??null)}</td></tr>
   </tbody></table></div>
   <p className="efops-error">Order-book snapshots have no certified cross-exchange settlement equivalence, source timestamp, fees, atomic fill guarantee, or alert eligibility. They must not be treated as executable arbitrage.</p>
  </>}
 </section>
}
