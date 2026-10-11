import {mirrorCollectorPayload} from '@/lib/intelligence-core/multisport-adapter';
import {fetchLiveScoreMesh} from '@/lib/liveScoreMesh';

export const dynamic='force-dynamic';

export async function GET(){
 try{
  const result=await fetchLiveScoreMesh();
  // Only provider-dated observations are mirrored; mesh observedAt is local fetch time.
  if(process.env.INTELLIGENCE_LIVE_SCORE_MIRROR==='true'){
   const games=Array.isArray(result.games)?result.games:[];
   const groups=new Map<string,unknown[]>();
   for(const game of games.slice(0,100)){
    if(!game.sourceObservedAt||!game.id||!game.source)continue;
    const data=groups.get(game.source)??[];
    data.push({eventId:game.id,observedAt:game.sourceObservedAt,
     home:game.home,away:game.away,status:game.status,sport:game.sport,league:game.league});
    groups.set(game.source,data);
   }
   for(const [provider,observations] of Array.from(groups).slice(0,3)){
    await Promise.race([
     mirrorCollectorPayload('score',observations,provider).catch(()=>undefined),
     new Promise<void>(resolve=>setTimeout(resolve,500))
    ]);
   }
  }
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
