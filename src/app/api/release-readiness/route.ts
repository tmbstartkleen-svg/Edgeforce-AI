import {getReleaseReadiness,recordReleaseAudit} from '@/lib/releaseReadiness';

export const dynamic='force-dynamic';

export async function GET(){
  try{
    const readiness=await getReleaseReadiness();
    return Response.json(readiness,{headers:{'Cache-Control':'no-store'}});
  }catch(error){
    return Response.json({
      version:'30.0.0',
      environment:process.env.VERCEL_ENV||process.env.NODE_ENV||'local',
      gitSha:process.env.VERCEL_GIT_COMMIT_SHA||process.env.GITHUB_SHA||null,
      readyForPreview:false,
      readyForProduction:false,
      blockers:[error instanceof Error?error.message:'Release readiness check failed'],
      warnings:[],
      checks:{}
    },{status:200,headers:{'Cache-Control':'no-store'}});
  }
}


export async function POST(req:Request){
  const key=req.headers.get('x-edgeforce-key');
  if(process.env.EDGEFORCE_WRITE_KEY&&key!==process.env.EDGEFORCE_WRITE_KEY){
    return Response.json({ok:false,error:'unauthorized'},{status:401});
  }
  try{
    const readiness=await getReleaseReadiness();
    const audit=await recordReleaseAudit(readiness);
    return Response.json({ok:true,readiness,audit},{headers:{'Cache-Control':'no-store'}});
  }catch(error){
    return Response.json({ok:false,error:error instanceof Error?error.message:'Release audit failed'},{status:500});
  }
}
