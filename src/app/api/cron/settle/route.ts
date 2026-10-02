import {runAutomaticSettlement} from '@/lib/resultProvider';

export const dynamic='force-dynamic';

export async function GET(req:Request){
 const auth=req.headers.get('authorization');
 if(process.env.CRON_SECRET && auth!==`Bearer ${process.env.CRON_SECRET}`)return Response.json({ok:false,error:'unauthorized'},{status:401});
 const result=await runAutomaticSettlement();
 return Response.json({...result,ranAt:new Date().toISOString()},{status:result.ok?200:200,headers:{'Cache-Control':'no-store'}});
}
