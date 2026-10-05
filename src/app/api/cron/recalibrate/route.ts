import {runRecalibration} from '@/lib/recalibrationEngine';
import {rebuildLearnedSgpCorrelations} from '@/lib/learnedSgpCorrelation';
import {recordAutomationRun} from '@/lib/automationHealth';
import {runModelGovernance} from '@/lib/modelGovernance';
import {runValidationLab} from '@/lib/validationLab';
import {trainAndPersistSportModels} from '@/lib/trainedSportModels';
import {runExternalMlTournament} from '@/lib/externalMlTournament';
import {runChampionDriftMonitor} from '@/lib/mlChampionDrift';
import {runShadowRecovery} from '@/lib/mlShadowRecovery';
import {rebuildPlayerCalibrationProfiles} from '@/lib/playerCalibration';
import {rebuildOpponentMatchupProfiles} from '@/lib/opponentMatchupLearning';

export const dynamic='force-dynamic';

export async function GET(req:Request){
 const auth=req.headers.get('authorization');
 if(process.env.CRON_SECRET&&auth!==`Bearer ${process.env.CRON_SECRET}`)return Response.json({ok:false,error:'unauthorized'},{status:401});
 const started=Date.now();
 try{
  const [modelCalibration,sgpCorrelation,modelGovernance,predictionValidation,trainedSportModels,playerCalibration,opponentMatchups]=await Promise.all([
   runRecalibration(),
   rebuildLearnedSgpCorrelations(),
   runModelGovernance(),
   runValidationLab(),
   trainAndPersistSportModels(),
   rebuildPlayerCalibrationProfiles(),
   rebuildOpponentMatchupProfiles()
  ]);
  const championDrift=await runChampionDriftMonitor().catch(error=>({ok:false,mode:'failed',error:error instanceof Error?error.message:'champion drift monitor failed'}));
  const shadowRecovery=await runShadowRecovery().catch(error=>({ok:false,mode:'failed',error:error instanceof Error?error.message:'shadow recovery failed'}));
  const externalMlTournament=await runExternalMlTournament().catch(error=>({ok:false,mode:'failed',error:error instanceof Error?error.message:'external ML tournament failed'}));
  await recordAutomationRun('recalibrate','success',started,{
   calibrationMode:(modelCalibration as any).mode||null,
   groups:(modelCalibration as any).groups?.length??null,
   sgpProfiles:(sgpCorrelation as any).profiles?.length??null,
   governanceChampions:(modelGovernance as any).summary?.champions??null,
   governanceDrifting:(modelGovernance as any).summary?.drifting??null,
   governanceCritical:(modelGovernance as any).summary?.critical??null,
   validationRows:(predictionValidation as any).report?.sampleSize??null,
   validationEligible:(predictionValidation as any).report?.evidence?.promotionEligible??null,
   trainedRows:(trainedSportModels as any).rows??null,
   trainedArtifacts:(trainedSportModels as any).artifacts?.length??null,
   trainedPromoted:(trainedSportModels as any).promoted??null,
   playerCalibrationRows:(playerCalibration as any).rowsRead??null,
   playerCalibrationProfiles:(playerCalibration as any).profilesWritten??null,
   playerCalibrationQualified:(playerCalibration as any).qualifiedProfiles??null,
   opponentMatchupRows:(opponentMatchups as any).rowsRead??null,
   opponentMatchupProfiles:(opponentMatchups as any).profilesWritten??null,
   opponentMatchupQualified:(opponentMatchups as any).qualifiedProfiles??null,
   opponentPlayerProfiles:(opponentMatchups as any).playerProfilesWritten??null,
   opponentPlayerQualified:(opponentMatchups as any).qualifiedPlayerProfiles??null,
   externalMlMode:(externalMlTournament as any).mode??null,
   externalMlCandidates:(externalMlTournament as any).candidates??null,
   externalMlPromoted:(externalMlTournament as any).promoted??null,
   championDriftChecked:(championDrift as any).champions??null,
   championDriftCritical:(championDrift as any).critical??null,
   championDriftQuarantined:(championDrift as any).quarantined??null,
   shadowRecoveryLeagues:(shadowRecovery as any).leagues??null,
   shadowRecoveryChecked:(shadowRecovery as any).challengers??null,
   shadowRecoveryReady:(shadowRecovery as any).readyConfirm??null,
   shadowRecoveryLeagueWinnersReady:(shadowRecovery as any).leagueWinnersReady??null,
   shadowRecoveryRecovered:(shadowRecovery as any).recovered??null,
   shadowRecoveryRejected:(shadowRecovery as any).rejected??null
  });
  return Response.json({ok:true,modelCalibration,sgpCorrelation,modelGovernance,predictionValidation,trainedSportModels,playerCalibration,opponentMatchups,championDrift,shadowRecovery,externalMlTournament,ranAt:new Date().toISOString()},{headers:{'Cache-Control':'no-store'}});
 }catch(error){
  const message=error instanceof Error?error.message:'recalibration failed';
  await recordAutomationRun('recalibrate','failed',started,{},message);
  return Response.json({ok:false,error:message},{status:500,headers:{'Cache-Control':'no-store'}});
 }
}
