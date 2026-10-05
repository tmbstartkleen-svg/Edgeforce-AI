import {loadScheduleFatigueSummary,rebuildScheduleFatigueProfiles} from '@/lib/scheduleFatigueIntelligence';

export const dynamic='force-dynamic';

export async function GET(){
 try{return Response.json({ok:true,build:'V67',schemaVersion:'v67-schedule-fatigue-1',...(await loadScheduleFatigueSummary())},{headers:{'Cache-Control':'no-store'}})}
 catch(error){return Response.json({ok:false,error:error instanceof Error?error.message:'schedule fatigue summary failed'},{status:500})}
}

export async function POST(req:Request){
 const auth=req.headers.get('authorization');
 if(process.env.CRON_SECRET&&auth!==`Bearer ${process.env.CRON_SECRET}`)return Response.json({ok:false,error:'unauthorized'},{status:401});
 try{return Response.json({ok:true,build:'V67',schemaVersion:'v67-schedule-fatigue-1',...(await rebuildScheduleFatigueProfiles())},{headers:{'Cache-Control':'no-store'}})}
 catch(error){return Response.json({ok:false,error:error instanceof Error?error.message:'schedule fatigue rebuild failed'},{status:500})}
}
