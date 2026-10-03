import {runRecalibration} from '@/lib/recalibrationEngine';
import {rebuildLearnedSgpCorrelations} from '@/lib/learnedSgpCorrelation';
import {recordAutomationRun} from '@/lib/automationHealth';
import {runModelGovernance} from '@/lib/modelGovernance';
import {runValidationLab} from '@/lib/validationLab';

export const dynamic='force-dynamic';

export async function GET(req:Request){
 const auth=req.headers.get('authorization');
 if(process.env.CRON_SECRET&&auth!==`Bearer ${process.env.CRON_SECRET}`)return Response.json({ok:false,error:'unauthorized'},{status:401});
 const started=Date.now();
 try{
  const [modelCalibration,sgpCorrelation,modelGovernance,predictionValidation]=await Promise.all([
   runRecalibration(),
   rebuildLearnedSgpCorrelations(),
   runModelGovernance(),
   runValidationLab()
  ]);
  await recordAutomationRun('recalibrate','success',started,{
   calibrationMode:(modelCalibration as any).mode||null,
   groups:(modelCalibration as any).groups?.length??null,
   sgpProfiles:(sgpCorrelation as any).profiles?.length??null,
   governanceChampions:(modelGovernance as any).summary?.champions??null,
   governanceDrifting:(modelGovernance as any).summary?.drifting??null,
   governanceCritical:(modelGovernance as any).summary?.critical??null,
   validationRows:(predictionValidation as any).report?.sampleSize??null,
   validationEligible:(predictionValidation as any).report?.evidence?.promotionEligible??null
  });
  return Response.json({ok:true,modelCalibration,sgpCorrelation,modelGovernance,predictionValidation,ranAt:new Date().toISOString()},{headers:{'Cache-Control':'no-store'}});
 }catch(error){
  const message=error instanceof Error?error.message:'recalibration failed';
  await recordAutomationRun('recalibrate','failed',started,{},message);
  return Response.json({ok:false,error:message},{status:500,headers:{'Cache-Control':'no-store'}});
 }
}
