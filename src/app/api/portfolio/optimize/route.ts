import {ingestOdds} from '@/lib/providers/ingest';
import {weekTop30} from '@/lib/scanner';
import {defaultLimits,optimizePortfolio} from '@/lib/portfolio';

export async function POST(req:Request){
 const body=await req.json().catch(()=>({}));
 const bankroll=Math.max(1,Number(body?.bankroll)||1000);
 const limits={...defaultLimits(bankroll),...(body?.limits||{}),bankroll};
 let source='request';
 let rows=Array.isArray(body?.rows)&&body.rows.length?body.rows:null;

 if(!rows){
  const ingestion=await ingestOdds();
  source=ingestion.source;
  rows=weekTop30(ingestion.markets,body?.risk||'Moderate');
 }

 return Response.json({
  source,
  limits,
  result:optimizePortfolio(rows,limits,Number(body?.drawdownPct)||0)
 });
}
