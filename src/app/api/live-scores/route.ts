import {fetchLiveScoreMesh} from '@/lib/liveScoreMesh';

export const dynamic='force-dynamic';

export async function GET(){
 try{
  const result=await fetchLiveScoreMesh();
  return Response.json(result,{headers:{
   'Cache-Control':'no-store, max-age=0',
   'CDN-Cache-Control':'no-store',
   'Cloudflare-CDN-Cache-Control':'no-store'
  }});
 }catch(error){
  return Response.json({
   ok:false,
   generatedAt:new Date().toISOString(),
   error:error instanceof Error?error.message:'live score mesh unavailable',
   games:[]
  },{status:503,headers:{'Cache-Control':'no-store'}});
 }
}
