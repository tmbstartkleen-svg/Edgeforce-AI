import {evaluateReadiness} from '@/lib/readiness';
import {recordHeartbeat,recordIncident} from '@/lib/ops';
import {recordAutomationRun} from '@/lib/automationHealth';
import {mlServiceConfigured,probeMlService} from '@/lib/mlServiceHealth';

export const dynamic='force-dynamic';

export async function GET(req:Request){
 const auth=req.headers.get('authorization');
 if(process.env.CRON_SECRET&&auth!==`Bearer ${process.env.CRON_SECRET}`)return Response.json({ok:false,error:'unauthorized'},{status:401});
 const started=Date.now();
 try{
  const readiness=await evaluateReadiness();
  const mlService=mlServiceConfigured()?await probeMlService().catch(error=>({ok:false,error:error instanceof Error?error.message:'ML service health probe failed'})):null;
  await recordHeartbeat(readiness);
  if(!readiness.ready){
   await recordIncident('ACTION','READINESS_FAILED','Edgeforce readiness check failed',{
    environment:readiness.environment,
    requiredFailures:readiness.requiredFailures,
   mlServiceOk:mlService?.ok??null,
    warnings:readiness.warnings
   });
  }
  await recordAutomationRun('heartbeat','success',started,{
   ready:readiness.ready,
   productionReady:readiness.productionReady,
   requiredFailures:readiness.requiredFailures
  });
  return Response.json({ok:true,readiness,mlService,ranAt:new Date().toISOString()},{headers:{'Cache-Control':'no-store'}});
 }catch(error){
  const message=error instanceof Error?error.message:'heartbeat failed';
  await recordAutomationRun('heartbeat','failed',started,{},message);
  return Response.json({ok:false,error:message},{status:500,headers:{'Cache-Control':'no-store'}});
 }
}
