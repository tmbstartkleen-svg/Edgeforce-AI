'use client';

import type {ExchangeEntryComparison} from '@/lib/pregameExchangeComparison';

const formatPrice=(value:number)=>`${Math.round(value*10000)/100}¢`;
const formatProbability=(value:number|null)=>value===null?'Unverified':`${(value*100).toFixed(1)}%`;

/** Read-only mobile panel. Caller must supply verified, dated model inputs. */
export function PregameEntryComparisonPanel({comparison}:{comparison:ExchangeEntryComparison|null}){
 if(!comparison)return <section aria-label="Pregame market entries" style={{padding:16,border:'1px solid #64748b',borderRadius:12}}>
  <h2>Pregame market entries</h2><p>No validated Kalshi or Polymarket scenarios are connected. Lower, Mid and High entries are unavailable.</p>
 </section>;
 return <section aria-label="Pregame market entries" style={{padding:16,border:'1px solid #64748b',borderRadius:12}}>
  <h2>Pregame market entries</h2>
  <p>Game: {comparison.gameId} · Scheduled: {comparison.gameStart}</p>
  <p role="status">{comparison.status==='ready_for_research'?'Research scenarios available — not approved for orders':'Insufficient evidence — no actionable entry recommendation'}</p>
  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,260px),1fr))',gap:12}}>
   {comparison.markets.map((market,i)=><article key={i} style={{border:'1px solid #64748b',borderRadius:10,padding:12,minWidth:0}}>
    <h3>{i===0?'Kalshi':'Polymarket'}</h3>
    <p>Status: {market.status}</p>
    {market.status==='ok'?<>
     <p>Projected low period: {market.projectedLowestWindow??'Unknown'}</p>
     <div style={{display:'grid',gap:8}}>
      {market.scenarioLevels.map(level=><div key={level.tier} style={{borderBottom:'1px solid #64748b',paddingBottom:8}}>
       <strong>{level.tier.toUpperCase()}: {formatPrice(level.limitPrice)}</strong>
       <div>Window: {level.period}</div>
       <div>Price touch: {formatProbability(level.touchProbability)}</div>
       <div>Order fill: {formatProbability(level.fillProbability)}</div>
       <div>Net EV / $1 contract: ${level.expectedValuePerContract.toFixed(3)}</div>
       <div>{level.eligible?'Within research edge threshold':'Does not meet entry threshold'}</div>
      </div>)}
     </div>
    </>:<p>Scenario levels withheld until evidence requirements are met.</p>}
   </article>)}
  </div>
  <p style={{fontSize:12}}>{comparison.warning}</p>
  <p style={{fontSize:12}}>No orders can be submitted from this panel. Model probabilities and fills require independent calibration.</p>
 </section>;
}
