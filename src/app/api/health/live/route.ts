import {RELEASE} from '@/lib/releaseManifest';

export const dynamic='force-dynamic';

export async function GET(){
 return Response.json({
  ok:true,
  live:true,
  build:RELEASE.build,
  version:RELEASE.appVersion,
  modelVersion:RELEASE.modelVersion,
  uptimeSeconds:Math.round(process.uptime()),
  time:new Date().toISOString()
 },{headers:{'Cache-Control':'no-store'}});
}
