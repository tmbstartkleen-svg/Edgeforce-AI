import {ingestOdds} from '@/lib/providers/ingest';
import {weekTop30} from '@/lib/scanner';
import {applyQualityGate} from '@/lib/qualityGate';
import {recordModelRuns} from '@/lib/persistence';
import {loadLearnedWeightMultipliers} from '@/lib/learnedWeights';

export async function GET(req:Request){
 const auth=req.headers.get('authorization');
 if(process.env.CRON_SECRET&&auth!==`Bearer ${process.env.CRON_SECRET}`)return Response.json({ok:false},{status:401});
 const [ingestion,learnedWeights]=await Promise.all([ingestOdds(),loadLearnedWeightMultipliers()]);
 const scanned=weekTop30(ingestion.markets,'Moderate',new Date(),learnedWeights);
 const rows=applyQualityGate(scanned);
 const modelRunsWritten=await recordModelRuns(rows).catch(()=>0);
 return Response.json({
  ok:true,
  ranAt:new Date().toISOString(),
  source:ingestion.source,
  mode:ingestion.mode,
  providerId:ingestion.providerId,
  attempts:ingestion.attempts,
  qualified:rows.length,
  modelRunsWritten,
  learnedWeightCount:Object.keys(learnedWeights).length,
  top:rows.slice(0,10)
 });
}
