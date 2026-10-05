import {runSloGovernor} from '@/lib/sloGovernor';
import {recordAutomationRun} from '@/lib/automationHealth';

export const dynamic='force-dynamic';

export async function GET(req:Request){
 const auth=req.headers.get('authorization');
 if(process.env.CRON_SECRET&&auth!==`Bearer ${process.env.CRON_SECRET}`)return Response.json({ok:false,error:'unauthorized'},{status:401});
 const started=Date.now();
 try{
  const report=await runSloGovernor();
  await recordAutomationRun('slo-governor','success',started,{
   state:report.state,
   deploymentAllowed:report.deploymentAllowed,
   freezeTriggered:report.freezeTriggered,
   recoveryEligible:report.recoveryEligible,
   recoveryStreak:report.recoveryStreak,
   oneHourBurn:report.windows.oneHour.burnRate,
   twentyFourHourBurn:report.windows.twentyFourHour.burnRate,
   sevenDayBudgetRemaining:report.windows.sevenDay.budgetRemaining
  });
  return Response.json({ok:true,build:'V74',schemaVersion:'v74-slo-governor-1',report,ranAt:new Date().toISOString()},{headers:{'Cache-Control':'no-store'}});
 }catch(error){
  const message=error instanceof Error?error.message:'SLO governor cron failed';
  await recordAutomationRun('slo-governor','failed',started,{},message);
  return Response.json({ok:false,error:message},{status:500,headers:{'Cache-Control':'no-store'}});
 }
}
