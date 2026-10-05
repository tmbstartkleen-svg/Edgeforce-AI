import {loadStartingLineupSummary,rebuildDepthChartProfiles} from '@/lib/startingLineupIntelligence';

export const dynamic='force-dynamic';

export async function GET(){
 try{return Response.json({ok:true,build:'V66',schemaVersion:'v66-starting-lineup-1',...(await loadStartingLineupSummary())},{headers:{'Cache-Control':'no-store'}})}
 catch(error){return Response.json({ok:false,error:error instanceof Error?error.message:'starting lineup summary failed'},{status:500})}
}

export async function POST(req:Request){
 const auth=req.headers.get('authorization');
 if(process.env.CRON_SECRET&&auth!==`Bearer ${process.env.CRON_SECRET}`)return Response.json({ok:false,error:'unauthorized'},{status:401});
 try{return Response.json({ok:true,build:'V66',schemaVersion:'v66-starting-lineup-1',...(await rebuildDepthChartProfiles())},{headers:{'Cache-Control':'no-store'}})}
 catch(error){return Response.json({ok:false,error:error instanceof Error?error.message:'depth chart rebuild failed'},{status:500})}
}
