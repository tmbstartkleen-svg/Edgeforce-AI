import {RELEASE} from '@/lib/releaseManifest';

export const dynamic='force-dynamic';

export async function GET(){
 if(process.env.ENABLE_TEST_ENDPOINTS!=='true')return Response.json({ok:false,error:'disabled'},{status:404});
 const vercel={platform:'vercel',version:RELEASE.appVersion,modelVersion:RELEASE.modelVersion,migrationVersion:RELEASE.migrationVersion,commitSha:'0123456789abcdef'};
 const cloudflare={...vercel,platform:'cloudflare'};
 return Response.json({
  ok:true,
  schemaVersion:'v103-platform-convergence-test-1',
  assertions:{
   releaseIdentityMatches:vercel.version===cloudflare.version,
   modelIdentityMatches:vercel.modelVersion===cloudflare.modelVersion,
   migrationIdentityMatches:vercel.migrationVersion===cloudflare.migrationVersion,
   commitIdentityMatches:vercel.commitSha===cloudflare.commitSha
  }
 });
}
