import {ingestOdds} from '@/lib/providers/ingest';
import {scanEdgeOpportunities} from '@/lib/edgeScanner';
import {rankValueBets} from '@/lib/valueBoard';
export const dynamic='force-dynamic';

export async function GET(request:Request){
  try{
    const url=new URL(request.url);
    const maxRows=Math.min(1000,Math.max(1,Number(url.searchParams.get('limit')||250)));
    if(!Number.isInteger(maxRows))return Response.json({ok:false,error:'INVALID_LIMIT'},{status:400});
    const ingestion=await ingestOdds();
    const result=scanEdgeOpportunities(ingestion.panelMarkets||[],{
      minEv:0,
      maxPositiveEv:10000,
      maxArbitrage:0
    });
    const rows=rankValueBets(result.positiveEv,{maxRows});
    return Response.json({
      ok:true,
      generatedAt:new Date().toISOString(),
      source:ingestion.source,
      providerDegraded:ingestion.degraded,
      candidateCount:result.positiveEvCount,
      returnedCount:rows.length,
      truncatedAtScanner:result.positiveEvCount>result.positiveEv.length,
      status:'PROVISIONAL_MARKET_REFERENCE',
      modelIndependent:false,
      oddsFreshnessVerified:false,
      eligibleForAutomatedBetAlerts:false,
      methodology:'Combined all-sports ranking by market-implied, de-vigged estimated ROI; not independent outcome-model forecasts.',
      rows
    },{headers:{'Cache-Control':'no-store, max-age=0'}});
  }catch(error){
    return Response.json({ok:false,error:'VALUE_BOARD_UNAVAILABLE',message:error instanceof Error?error.message:'failed'},
      {status:503,headers:{'Cache-Control':'no-store, max-age=0'}});
  }
}
