import {runIntelligenceCoreOnce} from '@/lib/intelligence-core/execution';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 const secret=process.env.CRON_SECRET;
 if(!secret)return Response.json({ok:false,error:'NOT_CONFIGURED'},{status:503});
 if(request.headers.get('authorization')!==`Bearer ${secret}`)return Response.json({ok:false,error:'UNAUTHORIZED'},{status:401});
 const result=await runIntelligenceCoreOnce({secret});
 return Response.json(result,{status:result.ok?200:503,headers:{'Cache-Control':'no-store'}});
}
