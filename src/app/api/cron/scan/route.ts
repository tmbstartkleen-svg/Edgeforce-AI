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
import {recordPlayerFeatureFrames} from '@/lib/playerFeatureFrames';
import {recordTrainedModelPredictionSnapshots} from '@/lib/trainedSportModels';
import {recordExternalMlPredictionSnapshots} from '@/lib/externalMlTournament';
import {recordShadowChallengerPredictions} from '@/lib/mlShadowRecovery';
import {recordLiveLineupSnapshots} from '@/lib/startingLineupIntelligence';
import {recordScheduleFatigueSnapshots} from '@/lib/scheduleFatigueIntelligence';
import {recordVenueConditionSnapshots} from '@/lib/venueWeatherIntelligence';
import {recordMarketMovementSnapshots} from '@/lib/marketMovementLearning';
import {runIntelligenceReliabilitySupervisor} from '@/lib/intelligenceReliability';

export const dynamic='force-dynamic';

export async function GET(req:Request){
 const auth=req.headers.get('authorization');
 if(process.env.CRON_SECRET&&auth!==`Bearer ${process.env.CRON_SECRET}`)return Response.json({ok:false,error:'unauthorized'},{status:401});
 const started=Date.now();
 try{
  const reliability=await runIntelligenceReliabilitySupervisor().catch(error=>({configured:false,mode:'DEGRADED' as const,score:.55,opened:0,recovered:0,rows:[],error:error instanceof Error?error.message:'reliability supervisor failed'}));
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
  const [modelRunsWritten,playerPropSnapshots,playerFeatureFrames,trainedModelSnapshots,externalMlSnapshots,shadowMlSnapshots,lineupSnapshots,scheduleFatigueSnapshots,venueConditionSnapshots,marketMovementSnapshots]=await Promise.all([
   recordModelRuns(rows).catch(()=>0),
   recordPlayerPropSnapshots(scanned).catch(()=>0),
   recordPlayerFeatureFrames(context.markets).catch(()=>0),
   recordTrainedModelPredictionSnapshots(context.markets).catch(()=>0),
   recordExternalMlPredictionSnapshots(context.markets).catch(()=>0),
   recordShadowChallengerPredictions(context.markets).catch(error=>({written:0,requested:0,challengers:0,mode:'failed',error:error instanceof Error?error.message:'shadow prediction failed'})),
   recordLiveLineupSnapshots(context.markets).catch(()=>0),
   recordScheduleFatigueSnapshots(context.markets).catch(()=>0),
   recordVenueConditionSnapshots(context.markets).catch(()=>0),
   recordMarketMovementSnapshots(context.markets).catch(()=>0)
  ]);
  await recordAutomationRun('scan','success',started,{
   source:ingestion.source,providerId:ingestion.providerId,qualified:rows.length,modelRunsWritten,
   playerPropSnapshots,playerFeatureFrames,trainedModelSnapshots,externalMlSnapshots,shadowMlSnapshots,lineupSnapshots,scheduleFatigueSnapshots,venueConditionSnapshots,marketMovementSnapshots,playerSync,
   dataQualityGrade:audit.grade,dataQualityScore:audit.score,
   reliabilityMode:(reliability as any).mode??null,reliabilityScore:(reliability as any).score??null,
   reliabilityOpened:(reliability as any).opened??0,reliabilityRecovered:(reliability as any).recovered??0
  });
  return Response.json({
   ok:true,ranAt:new Date().toISOString(),source:ingestion.source,mode:ingestion.mode,
   providerId:ingestion.providerId,attempts:ingestion.attempts,qualified:rows.length,
   modelRunsWritten,playerPropSnapshots,playerFeatureFrames,trainedModelSnapshots,externalMlSnapshots,shadowMlSnapshots,lineupSnapshots,scheduleFatigueSnapshots,venueConditionSnapshots,marketMovementSnapshots,playerSync,learnedWeightCount:Object.keys(learnedWeights).length,
   dynamicCalibrationProfileCount:Object.keys(dynamicCalibration).length,
   contextDiagnostics:context.diagnostics,
   reliability,
   dataQuality:audit,top:rows.slice(0,10)
  },{headers:{'Cache-Control':'no-store'}});
 }catch(error){
  const message=error instanceof Error?error.message:'scan failed';
  await recordAutomationRun('scan','failed',started,{},message);
  return Response.json({ok:false,error:message},{status:500,headers:{'Cache-Control':'no-store'}});
 }
}
