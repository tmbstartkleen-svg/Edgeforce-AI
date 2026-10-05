import {refreshLiveInjuryTracking} from '@/lib/liveInjuryTracking';
import {recordAutomationRun} from '@/lib/automationHealth';

export const dynamic='force-dynamic';

export async function GET(req:Request){
 const auth=req.headers.get('authorization');
 if(process.env.CRON_SECRET&&auth!==`Bearer ${process.env.CRON_SECRET}`)return Response.json({ok:false,error:'unauthorized'},{status:401});
 const started=Date.now();
 try{
  const result=await refreshLiveInjuryTracking();
  await recordAutomationRun('injuries','success',started,{
   providerId:result.providerId||null,rows:result.snapshotRows,degraded:result.degraded
  });
  return Response.json({ok:result.ok,build:'V64.1',schemaVersion:'v64-live-injuries-1',...result},{headers:{'Cache-Control':'no-store'}});
 }catch(error){
  const message=error instanceof Error?error.message:'injury refresh failed';
  await recordAutomationRun('injuries','failed',started,{},message);
  return Response.json({ok:false,error:message},{status:500,headers:{'Cache-Control':'no-store'}});
 }
}
