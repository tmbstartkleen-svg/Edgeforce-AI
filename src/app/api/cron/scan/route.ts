import {ingestOdds} from '@/lib/providers/ingest';
import {weekTop30} from '@/lib/scanner';
import {applyQualityGate} from '@/lib/qualityGate';

export async function GET(req:Request){
 const auth=req.headers.get('authorization');
 if(process.env.CRON_SECRET&&auth!==`Bearer ${process.env.CRON_SECRET}`)return Response.json({ok:false},{status:401});
 const ingestion=await ingestOdds();
 const scanned=weekTop30(ingestion.markets);
 const rows=applyQualityGate(scanned);
 return Response.json({
  ok:true,
  ranAt:new Date().toISOString(),
  source:ingestion.source,
  mode:ingestion.mode,
  providerId:ingestion.providerId,
  attempts:ingestion.attempts,
  qualified:rows.length,
  top:rows.slice(0,10)
 });
}
