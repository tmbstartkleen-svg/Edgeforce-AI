'use client';
import {useMemo,useState} from 'react';
import {runArbPreset,type ArbPreset} from '@/lib/guaranteedPayoutPresets';
import {scanGuaranteedPayout} from '@/lib/guaranteedPayoutScanner';
import {analyzeThreeWayDip} from '@/lib/soccerThreeWayDipArb';

const examples:{id:ArbPreset;name:string}[]=[
 {id:'soccer_three_way',name:'Soccer · Home / Draw / Away'},
 {id:'binary_cross_venue',name:'YES / NO · Two venues'},
 {id:'two_game_full_cover',name:'Two games · Full coverage'},
 {id:'incomplete_cover',name:'Two games · Missing outcome'}
];
export function GuaranteedPayoutResearchPanel(){
 const [preset,setPreset]=useState<ArbPreset>('soccer_three_way');
 const [home,setHome]=useState(30);
 const [draw,setDraw]=useState(20);
 const [away,setAway]=useState(35);
 const [fee,setFee]=useState(1);
 const [fills,setFills]=useState([100,100,100]);
 const [feeMode,setFeeMode]=useState<'maker'|'taker'>('maker');
 const [takerFee,setTakerFee]=useState(2);
 const report=useMemo(()=>{
  if(preset!=='soccer_three_way')return runArbPreset(preset);
  const prices=[home,draw,away];
  return scanGuaranteedPayout([{id:'soccer',outcomes:['home','draw','away']}],
   ['home','draw','away'].map((outcome,i)=>({id:outcome,venue:'paper_fixture',selections:{soccer:outcome},stake:prices[i],decimalOdds:100/prices[i],fees:fee,fullyFilled:true})),true);
 },[preset,home,draw,away,fee]);
 const partial=useMemo(()=>analyzeThreeWayDip(
  (['home','draw','away'] as const).map((outcome,i)=>({
   outcome,venue:'kalshi' as const,price:[home,draw,away][i]/100,
   feePerContract:(feeMode==='maker'?fee:takerFee)/100,filledContracts:fills[i]
  })),true),[home,draw,away,fee,takerFee,feeMode,fills]);
 const activeCost=preset==='soccer_three_way'?partial.cost+partial.fees:report.totalCost;
 const activeWorst=preset==='soccer_three_way'?partial.worstCaseProfit:report.worstCaseNet;
 const activeBest=preset==='soccer_three_way'?Math.max(...Object.values(partial.profitByOutcome)):report.bestCaseNet;
 const activeGuaranteed=preset==='soccer_three_way'?partial.guaranteedProfit:report.guaranteedProfit;
 const money=(value:number|null)=>value===null?'Unavailable':(value<0?'−':'')+'$'+Math.abs(value).toFixed(2);
 return <section aria-label="Guaranteed payout research scanner" style={{border:'1px solid #64748b',borderRadius:12,padding:16,marginTop:16}}>
  <h2>Guaranteed-Payout Scanner</h2>
  <p>Paper scenarios only · No live odds or submitted orders</p>
  <label htmlFor="arb-research-preset">Select scenario</label>
  <select id="arb-research-preset" value={preset} onChange={e=>setPreset(e.target.value as ArbPreset)}
   style={{display:'block',width:'100%',maxWidth:440,padding:10,marginTop:8,marginBottom:16}}>
   {examples.map(example=><option key={example.id} value={example.id}>{example.name}</option>)}
  </select>
  {preset==='soccer_three_way'&&<fieldset style={{border:'1px solid #64748b',borderRadius:8,padding:12,marginBottom:16}}>
   <legend>Editable paper buy prices (cents)</legend>
   {([{name:'Home',value:home,set:setHome},{name:'Draw',value:draw,set:setDraw},{name:'Away',value:away,set:setAway}] as const).map(item=>
    <label key={item.name} style={{display:'block',marginBottom:12}}>
     {item.name}: {item.value}¢
     <input type="range" min="1" max="99" step="1" value={item.value}
      onChange={e=>item.set(Number(e.target.value))} style={{display:'block',width:'100%'}}/>
    </label>)}
   <label>Fee per outcome ticket ($)
    <input type="number" min="0" max="25" step="0.25" value={fee}
     onChange={e=>setFee(Math.max(0,Math.min(25,Number(e.target.value)||0)))}
     style={{display:'block',maxWidth:120,width:'100%',padding:8,marginTop:4}}/>
   </label>
   <label style={{display:'block',marginTop:12}}>Fee scenario
    <select value={feeMode} onChange={e=>setFeeMode(e.target.value as 'maker'|'taker')}
     style={{display:'block',width:'100%',maxWidth:220,padding:8}}>
     <option value="maker">Maker (illustrative)</option>
     <option value="taker">Taker (illustrative)</option>
    </select>
   </label>
   {feeMode==='taker'&&<label style={{display:'block',marginTop:8}}>Taker fee per 100 contracts ($)
    <input type="number" min="0" max="25" step="0.25" value={takerFee}
     onChange={e=>setTakerFee(Math.max(0,Math.min(25,Number(e.target.value)||0)))}
     style={{display:'block',maxWidth:120,width:'100%',padding:8}}/>
   </label>}
   <p><strong>Confirmed fills (paper)</strong></p>
   {(['Home','Draw','Away'] as const).map((name,i)=><label key={name} style={{display:'block',marginBottom:8}}>
    {name}: {fills[i]} / 100
    <input type="range" min="0" max="100" step="1" value={fills[i]}
     onChange={e=>setFills(old=>old.map((n,j)=>j===i?Number(e.target.value):n))}
     style={{display:'block',width:'100%'}}/>
   </label>)}
   <div aria-live="polite">
    <p>Actual modeled filled-position cost + fees: {money(partial.cost+partial.fees)}</p>
    <p>Worst-case filled-position P&amp;L: <strong>{money(partial.worstCaseProfit)}</strong></p>
    <p>Complete matched sets: {partial.completeSets} · {partial.status==='partial_exposure'?'Unequal fills: directional exposure':'Equal filled quantities'}</p>
   </div>
   <p style={{fontSize:12}}>The summary below uses the selected filled quantities and fee scenario. Neither fee scenario is an exchange quote.</p>
  </fieldset>}
  <dl style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:12}}>
   <div><dt>Outcome combinations</dt><dd>{report.scenarios}</dd></div>
   <div><dt>Total cost</dt><dd>{money(activeCost)}</dd></div>
   <div><dt>Worst-case net</dt><dd>{money(activeWorst)}</dd></div>
   <div><dt>Best-case net</dt><dd>{money(activeBest)}</dd></div>
   <div><dt>Uncovered outcomes</dt><dd>{report.uncoveredScenarios}</dd></div>
  </dl>
  <p role="status"><strong>{activeGuaranteed?'Positive in all modeled outcomes':'No guaranteed profit established'}</strong></p>
  <p style={{fontSize:12}}>{report.warning}</p>
  <p style={{fontSize:12}}>All prices and filled positions are hypothetical. Actual settlement, exchange fees, liquidity and fill evidence are not connected.</p>
 </section>;
}
