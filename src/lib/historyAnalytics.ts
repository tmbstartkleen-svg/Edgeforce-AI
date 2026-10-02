import type {HistoricalBet,HistoricalLeg} from './betHistory';

type Summary={
 key:string;
 count:number;
 hits:number;
 misses:number;
 pushes:number;
 pending:number;
 hitRate:number;
 staked:number;
 returned:number;
 net:number;
 roi:number;
};

const settledBet=(x:HistoricalBet)=>x.result==='win'||x.result==='loss'||x.result==='push';
const settledLeg=(x:HistoricalLeg)=>x.result==='win'||x.result==='loss'||x.result==='push';

function summarize(rows:HistoricalBet[],key:string):Summary{
 const settled=rows.filter(settledBet);
 const decisionRows=settled.filter(x=>x.result==='win'||x.result==='loss');
 const hits=settled.filter(x=>x.result==='win').length;
 const misses=settled.filter(x=>x.result==='loss').length;
 const pushes=settled.filter(x=>x.result==='push').length;
 const pending=rows.filter(x=>x.result==='open').length;
 const staked=settled.reduce((s,x)=>s+x.stake,0);
 const returned=settled.reduce((s,x)=>s+x.paid,0);
 const net=returned-staked;
 return {
  key,count:rows.length,hits,misses,pushes,pending,
  hitRate:decisionRows.length?hits/decisionRows.length:0,
  staked,returned,net,roi:staked?net/staked:0
 };
}

function legSummary(rows:HistoricalLeg[],key:string){
 const known=rows.filter(settledLeg);
 const decisions=known.filter(x=>x.result==='win'||x.result==='loss');
 const hits=known.filter(x=>x.result==='win').length;
 const misses=known.filter(x=>x.result==='loss').length;
 const pushes=known.filter(x=>x.result==='push').length;
 return {key,count:known.length,hits,misses,pushes,pending:rows.length-known.length,hitRate:decisions.length?hits/decisions.length:0};
}

function average(values:Array<number|undefined>){
 const known=values.filter((x):x is number=>typeof x==='number'&&Number.isFinite(x));
 return known.length?known.reduce((s,x)=>s+x,0)/known.length:undefined;
}

export function analyzeHistory(history:HistoricalBet[]){
 const overall=summarize(history,'Overall');
 const sports=[...new Set(history.map(x=>x.sport))].map(key=>summarize(history.filter(x=>x.sport===key),key))
  .sort((a,b)=>b.roi-a.roi||b.hitRate-a.hitRate);
 const legCounts=[...new Set(history.map(x=>x.legCount).filter(x=>x>0))].sort((a,b)=>a-b)
  .map(n=>summarize(history.filter(x=>x.legCount===n),String(n)));
 const allLegs=history.flatMap(x=>x.legs);
 const legSports=[...new Set(allLegs.map(x=>x.sport))].map(key=>legSummary(allLegs.filter(x=>x.sport===key),key))
  .sort((a,b)=>b.hitRate-a.hitRate||b.count-a.count);
 const markets=[...new Set(allLegs.map(x=>x.marketType))].map(key=>legSummary(allLegs.filter(x=>x.marketType===key),key))
  .sort((a,b)=>b.hitRate-a.hitRate||b.count-a.count);

 const winners=history.filter(x=>x.result==='win');
 const losers=history.filter(x=>x.result==='loss');
 const winningLegs=allLegs.filter(x=>x.result==='win');
 const losingLegs=allLegs.filter(x=>x.result==='loss');
 const avgModelWinner=average([...winners.map(x=>x.modelProbability),...winningLegs.map(x=>x.modelProbability)]);
 const avgModelLoser=average([...losers.map(x=>x.modelProbability),...losingLegs.map(x=>x.modelProbability)]);

 const probabilityBands=[
  {key:'<55%',min:0,max:.55},
  {key:'55-60%',min:.55,max:.60},
  {key:'60-65%',min:.60,max:.65},
  {key:'65-70%',min:.65,max:.70},
  {key:'70-80%',min:.70,max:.80},
  {key:'80%+',min:.80,max:1.001}
 ].map(band=>{
  const rows=allLegs.filter(x=>typeof x.modelProbability==='number'&&x.modelProbability>=band.min&&x.modelProbability<band.max);
  return legSummary(rows,band.key);
 }).filter(x=>x.count||x.pending);

 const settledSports=sports.filter(x=>x.hits+x.misses>=2);
 const settledSizes=legCounts.filter(x=>x.hits+x.misses>=2);
 return {
  overall,sports,legCounts,legSports,markets,probabilityBands,
  sampleSize:history.length,
  settledCount:history.filter(settledBet).length,
  pendingCount:history.filter(x=>x.result==='open').length,
  avgModelWinner,
  avgModelLoser,
  bestSport:settledSports[0]?.key,
  bestParlaySize:[...settledSizes].sort((a,b)=>b.roi-a.roi||b.hitRate-a.hitRate)[0]?.key
 };
}
