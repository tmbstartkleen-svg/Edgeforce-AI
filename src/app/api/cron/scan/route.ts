import {ingestOdds} from '@/lib/providers/ingest';
import {weekTop30} from '@/lib/scanner';
import {applyQualityGate} from '@/lib/qualityGate';
import {recordModelRuns} from '@/lib/persistence';
import {loadLearnedWeightMultipliers} from '@/lib/learnedWeights';
import {loadDynamicCalibrationProfiles} from '@/lib/regimeConfidence';
import {enrichMarketsWithContext} from '@/lib/providers/contextFusion';
import {recordAutomationRun} from '@/lib/automationHealth';
import {auditMarketBatch} from '@/lib/dataQuality';
import {recordPlayerPropSnapshots,syncPlayerWarehouseFromStatsProvider} from '@/lib/playerWarehouse';
import {recordTrainedModelPredictionSnapshots} from '@/lib/trainedSportModels';
import {recordExternalMlPredictionSnapshots} from '@/lib/externalMlTournament';

export const dynamic='force-dynamic';

export async function GET(req:Request){
 const auth=req.headers.get('authorization');
 if(process.env.CRON_SECRET&&auth!==`Bearer ${process.env.CRON_SECRET}`)return Response.json({ok:false,error:'unauthorized'},{status:401});
 const started=Date.now();
 try{
  const [ingestion,learnedWeights,dynamicCalibration,playerSync]=await Promise.all([
   ingestOdds(),loadLearnedWeightMultipliers(),loadDynamicCalibrationProfiles(),
   syncPlayerWarehouseFromStatsProvider().catch(error=>({
    configured:false,rowsSeen:0,gamesWritten:0,athletesTouched:0,featureSnapshotsWritten:0,
    error:error instanceof Error?error.message:'player sync failed'
   }))
  ]);
  const context=await enrichMarketsWithContext(ingestion.markets);
  const audit=auditMarketBatch(context.markets);
  const scanned=weekTop30(context.markets,'Moderate',new Date(),learnedWeights,dynamicCalibration);
  const rows=applyQualityGate(scanned);
  const [modelRunsWritten,playerPropSnapshots,trainedModelSnapshots,externalMlSnapshots]=await Promise.all([
   recordModelRuns(rows).catch(()=>0),
   recordPlayerPropSnapshots(scanned).catch(()=>0),
   recordTrainedModelPredictionSnapshots(context.markets).catch(()=>0),
   recordExternalMlPredictionSnapshots(context.markets).catch(()=>0)
  ]);
  await recordAutomationRun('scan','success',started,{
   source:ingestion.source,providerId:ingestion.providerId,qualified:rows.length,modelRunsWritten,
   playerPropSnapshots,trainedModelSnapshots,externalMlSnapshots,playerSync,
   dataQualityGrade:audit.grade,dataQualityScore:audit.score
  });
  return Response.json({
   ok:true,ranAt:new Date().toISOString(),source:ingestion.source,mode:ingestion.mode,
   providerId:ingestion.providerId,attempts:ingestion.attempts,qualified:rows.length,
   modelRunsWritten,playerPropSnapshots,trainedModelSnapshots,externalMlSnapshots,playerSync,learnedWeightCount:Object.keys(learnedWeights).length,
   dynamicCalibrationProfileCount:Object.keys(dynamicCalibration).length,
   contextDiagnostics:context.diagnostics,
   dataQuality:audit,top:rows.slice(0,10)
  },{headers:{'Cache-Control':'no-store'}});
 }catch(error){
  const message=error instanceof Error?error.message:'scan failed';
  await recordAutomationRun('scan','failed',started,{},message);
  return Response.json({ok:false,error:message},{status:500,headers:{'Cache-Control':'no-store'}});
 }
}
