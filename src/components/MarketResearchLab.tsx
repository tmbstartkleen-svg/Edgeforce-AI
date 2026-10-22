'use client';
import {useState} from 'react';
import {evaluateTwoWayArbitrage,twoWayFairPrice} from '@/lib/firstPartyMarketMath';
const field:React.CSSProperties={padding:'12px',borderRadius:8,minWidth:110,width:'100%',background:'#f7fafb',color:'#172330'};
export default function MarketResearchLab(){
 const [a,setA]=useState('+120'),[b,setB]=useState('+120');
 const [capA,setCapA]=useState('100'),[capB,setCapB]=useState('100');
 const [result,setResult]=useState<ReturnType<typeof evaluateTwoWayArbitrage>|null>(null);
 const [fair,setFair]=useState<ReturnType<typeof twoWayFairPrice>|null>(null);
 const [error,setError]=useState('');
 const evaluate=()=>{setError('');setResult(null);setFair(null);try{
  const oddA=Number(a),oddB=Number(b),stakeA=Number(capA),stakeB=Number(capB);
  if(![oddA,oddB,stakeA,stakeB].every(Number.isFinite))throw Error('Enter finite numerical values.');
  const now=new Date().toISOString();
  setFair(twoWayFairPrice(oddA,oddB));
  setResult(evaluateTwoWayArbitrage([
   {side:'A',americanOdds:oddA,maxStake:stakeA,source:'MANUAL_A',observedAt:now,rulesKey:'MANUAL_ASSUMED_MATCH'},
   {side:'B',americanOdds:oddB,maxStake:stakeB,source:'MANUAL_B',observedAt:now,rulesKey:'MANUAL_ASSUMED_MATCH'}],now));
 }catch(e){setError(e instanceof Error?e.message:'Invalid research inputs');}};
 return <section className="coveragePanel" aria-label="Manual market research calculator" style={{padding:22,marginBottom:20}}>
  <div className="coveragePanelHead"><div><div className="eyebrow">FIRST-PARTY MARKET RESEARCH</div><h2>Fair-price and theoretical arbitrage lab</h2></div></div>
  <p className="coverageNote">Manual hypothetical inputs only. No connected sportsbook price, executable arb, guaranteed edge, model probability or verified settlement-rule comparison is implied. Check the same event, market, outcome, line, terms and executable stakes independently.</p>
  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:12}}>
   <label>Outcome A American odds<input aria-label="Outcome A odds" style={field} value={a} onChange={e=>setA(e.target.value)}/></label>
   <label>Outcome B American odds<input aria-label="Outcome B odds" style={field} value={b} onChange={e=>setB(e.target.value)}/></label>
   <label>Maximum A stake ($)<input aria-label="Maximum A stake" style={field} value={capA} onChange={e=>setCapA(e.target.value)}/></label>
   <label>Maximum B stake ($)<input aria-label="Maximum B stake" style={field} value={capB} onChange={e=>setCapB(e.target.value)}/></label>
  </div>
  <div className="coverageTools" style={{marginTop:16}}><button type="button" onClick={evaluate}>Calculate research scenario</button><button type="button" onClick={()=>{setA('');setB('');setCapA('');setCapB('');setResult(null);setFair(null);setError('')}}>Clear scenario</button></div>
  {error&&<p role="alert">{error}</p>}
  {fair&&result&&<div aria-live="polite"><div className="coverageKpis">
   <article><small>NO-VIG FAIR PROBABILITY A</small><strong>{(100*fair.fairA).toFixed(2)}%</strong><span>Proportional devig estimate</span></article>
   <article><small>NO-VIG FAIR PROBABILITY B</small><strong>{(100*fair.fairB).toFixed(2)}%</strong><span>Not an independent model</span></article>
   <article><small>THEORETICAL GROSS ROI</small><strong>{result.grossRoi===null?'Unavailable':(result.grossRoi*100).toFixed(2)+'%'}</strong><span>Before fees, limits and slippage</span></article>
   <article><small>QUALIFICATION</small><strong>{result.status==='GROSS_ARBITRAGE'?'Hypothetical only':'Research only'}</strong><span>Not executable or certified</span></article>
  </div><p className="coverageNote">Theoretical allocations: A ${result.stakeA.toFixed(2)} · B ${result.stakeB.toFixed(2)}. {result.reasons.join(', ')||'Gross mathematical condition met, NOT verified in the market.'} {result.warning}</p></div>}
 </section>;
}
