import {runAutomaticSettlement} from '@/lib/resultProvider';
import {recordAutomationRun} from '@/lib/automationHealth';

export const dynamic='force-dynamic';

export async function GET(req:Request){
 const auth=req.headers.get('authorization');
 if(process.env.CRON_SECRET&&auth!==`Bearer ${process.env.CRON_SECRET}`)return Response.json({ok:false,error:'unauthorized'},{status:401});
 const started=Date.now();
 try{
  const result=await runAutomaticSettlement();
  await recordAutomationRun('settle',result.ok?'success':'failed',started,{result},result.ok?undefined:String((result as any).error||'settlement reported not ok'));
  return Response.json({...result,ranAt:new Date().toISOString()},{status:200,headers:{'Cache-Control':'no-store'}});
 }catch(error){
  const message=error instanceof Error?error.message:'settlement failed';
  await recordAutomationRun('settle','failed',started,{},message);
  return Response.json({ok:false,error:message,ranAt:new Date().toISOString()},{status:500,headers:{'Cache-Control':'no-store'}});
 }
}
