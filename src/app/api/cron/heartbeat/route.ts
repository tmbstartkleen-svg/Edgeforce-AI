import {evaluateReadiness} from '@/lib/readiness';
import {recordHeartbeat,recordIncident} from '@/lib/ops';

export const dynamic='force-dynamic';

export async function GET(req:Request){
 const auth=req.headers.get('authorization');
 if(process.env.CRON_SECRET&&auth!==`Bearer ${process.env.CRON_SECRET}`)return Response.json({ok:false,error:'unauthorized'},{status:401});
 const readiness=await evaluateReadiness();
 await recordHeartbeat(readiness);
 if(!readiness.ready){
  await recordIncident('ACTION','READINESS_FAILED','Edgeforce readiness check failed',{
   environment:readiness.environment,
   requiredFailures:readiness.requiredFailures,
   warnings:readiness.warnings
  });
 }
 return Response.json({ok:true,readiness,ranAt:new Date().toISOString()},{headers:{'Cache-Control':'no-store'}});
}
