import {getReleaseReadiness,recordReleaseAudit} from '@/lib/releaseReadiness';

export const dynamic='force-dynamic';

export async function GET(){
  try{
    const readiness=await getReleaseReadiness();
    await recordReleaseAudit(readiness).catch(()=>undefined);
    return Response.json(readiness,{headers:{'Cache-Control':'no-store'}});
  }catch(error){
    return Response.json({
      version:'29.0.0',
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
