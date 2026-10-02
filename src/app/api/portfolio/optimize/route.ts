import {ingestOdds} from '@/lib/providers/ingest';
import {weekTop30} from '@/lib/scanner';
import {defaultLimits,optimizePortfolio} from '@/lib/portfolio';
import {loadLearnedWeightMultipliers} from '@/lib/learnedWeights';
import {enrichMarketsWithContext} from '@/lib/providers/contextFusion';

export async function POST(req:Request){
 const body=await req.json().catch(()=>({}));
 const bankroll=Math.max(1,Number(body?.bankroll)||1000);
 const limits={...defaultLimits(bankroll),...(body?.limits||{}),bankroll};
 let source='request';
 let rows=Array.isArray(body?.rows)&&body.rows.length?body.rows:null;

 if(!rows){
  const [ingestion,learnedWeights]=await Promise.all([ingestOdds(),loadLearnedWeightMultipliers()]);
  const context=await enrichMarketsWithContext(ingestion.markets);
  source=ingestion.source;
  rows=weekTop30(context.markets,body?.risk||'Moderate',new Date(),learnedWeights);
 }

 return Response.json({
  source,
  limits,
  result:optimizePortfolio(rows,limits,Number(body?.drawdownPct)||0)
 });
}
