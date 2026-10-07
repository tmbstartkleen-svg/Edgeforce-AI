import {getProductionTopologyStatus} from '@/lib/productionTopologyWatchdog';
import {recordAutomationRun} from '@/lib/automationHealth';

export const dynamic='force-dynamic';

export async function GET(req:Request){
 const auth=req.headers.get('authorization');
 if(process.env.CRON_SECRET&&auth!==`Bearer ${process.env.CRON_SECRET}`)return Response.json({ok:false,error:'unauthorized'},{status:401});
 const started=Date.now();
 try{
  const report=await getProductionTopologyStatus();
  await recordAutomationRun('topology-watchdog',report.ready?'success':'failed',started,{
   state:report.state,
   ready:report.ready,
   primaryCurrent:report.primaryCurrent,
   standbyConfigured:report.standbyConfigured,
   standbyLive:report.standbyLive,
   failoverReady:report.failoverReady,
   primaryCommitSha:report.primary.commitSha,
   standbyCommitSha:report.standby.commitSha,
   standbyDeploymentId:report.standby.deploymentId,
   blockers:report.blockers,
   warnings:report.warnings
  },report.ready?undefined:report.blockers.join('; '));
  return Response.json(report,{
   status:report.ready?200:503,
   headers:{'Cache-Control':'no-store','x-edgeforce-topology-watchdog':'v146'}
  });
 }catch(error){
  const message=error instanceof Error?error.message:'topology watchdog failed';
  await recordAutomationRun('topology-watchdog','failed',started,{},message);
  return Response.json({ok:false,error:message},{status:500,headers:{'Cache-Control':'no-store'}});
 }
}
