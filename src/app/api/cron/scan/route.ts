import {ingestOdds} from '@/lib/providers/ingest';
import {weekTop30} from '@/lib/scanner';
import {applyQualityGate} from '@/lib/qualityGate';
import {recordModelRuns} from '@/lib/persistence';
import {loadLearnedWeightMultipliers} from '@/lib/learnedWeights';
import {loadDynamicCalibrationProfiles} from '@/lib/regimeConfidence';
import {recordAutomationRun} from '@/lib/automationHealth';
import {auditMarketBatch} from '@/lib/dataQuality';

export const dynamic='force-dynamic';

export async function GET(req:Request){
 const auth=req.headers.get('authorization');
 if(process.env.CRON_SECRET&&auth!==`Bearer ${process.env.CRON_SECRET}`)return Response.json({ok:false,error:'unauthorized'},{status:401});
 const started=Date.now();
 try{
  const [ingestion,learnedWeights,dynamicCalibration]=await Promise.all([
   ingestOdds(),loadLearnedWeightMultipliers(),loadDynamicCalibrationProfiles()
  ]);
  const audit=auditMarketBatch(ingestion.markets);
  const scanned=weekTop30(ingestion.markets,'Moderate',new Date(),learnedWeights,dynamicCalibration);
  const rows=applyQualityGate(scanned);
  const modelRunsWritten=await recordModelRuns(rows).catch(()=>0);
  await recordAutomationRun('scan','success',started,{
   source:ingestion.source,providerId:ingestion.providerId,qualified:rows.length,modelRunsWritten,
   dataQualityGrade:audit.grade,dataQualityScore:audit.score
  });
  return Response.json({
   ok:true,ranAt:new Date().toISOString(),source:ingestion.source,mode:ingestion.mode,
   providerId:ingestion.providerId,attempts:ingestion.attempts,qualified:rows.length,
   modelRunsWritten,learnedWeightCount:Object.keys(learnedWeights).length,
   dynamicCalibrationProfileCount:Object.keys(dynamicCalibration).length,
   dataQuality:audit,top:rows.slice(0,10)
  },{headers:{'Cache-Control':'no-store'}});
 }catch(error){
  const message=error instanceof Error?error.message:'scan failed';
  await recordAutomationRun('scan','failed',started,{},message);
  return Response.json({ok:false,error:message},{status:500,headers:{'Cache-Control':'no-store'}});
 }
}
