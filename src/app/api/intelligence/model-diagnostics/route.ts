import {demoMarkets} from '@/lib/demo';
import {explainMarket} from '@/lib/explainability';
import {loadLearnedWeightMultipliers} from '@/lib/learnedWeights';
import {latestStoredMarkets} from '@/lib/persistence';

export const dynamic='force-dynamic';

export async function GET(){
 const [stored,learnedWeights]=await Promise.all([
  latestStoredMarkets(120).catch(()=>[]),
  loadLearnedWeightMultipliers()
 ]);
 const markets=(stored.length?stored:demoMarkets).slice(0,100);
 const rows=markets.map(m=>({
  market:{id:m.id,sport:m.sport,event:m.event,selection:m.selection,market:m.market},
  explanation:explainMarket(m,learnedWeights)
 }));
 const fragility={robust:0,moderate:0,fragile:0};
 const dominant=new Map<string,number>();
 for(const row of rows){
  const f=row.explanation.diagnostics.fragility.toLowerCase() as keyof typeof fragility;
  fragility[f]++;
  const name=row.explanation.diagnostics.dominantModel;
  dominant.set(name,(dominant.get(name)||0)+1);
 }
 const avg=(fn:(r:(typeof rows)[number])=>number)=>rows.length?rows.reduce((s,r)=>s+fn(r),0)/rows.length:0;
 return Response.json({
  ok:true,
  source:stored.length?'database':'demo',
  sampleSize:rows.length,
  summary:{
   fragility,
   averageAgreement:avg(r=>r.explanation.diagnostics.councilAgreement),
   averageEffectiveModelCount:avg(r=>r.explanation.diagnostics.effectiveModelCount),
   averageWeightConcentration:avg(r=>r.explanation.diagnostics.weightConcentration),
   averageAbsoluteEdge:avg(r=>Math.abs(r.explanation.edge)),
   dominantModels:[...dominant.entries()].map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count)
  },
  mostFragile:[...rows].sort((a,b)=>b.explanation.diagnostics.fragilityRatio-a.explanation.diagnostics.fragilityRatio).slice(0,20),
  largestEdges:[...rows].sort((a,b)=>Math.abs(b.explanation.edge)-Math.abs(a.explanation.edge)).slice(0,20)
 },{headers:{'Cache-Control':'no-store'}});
}
