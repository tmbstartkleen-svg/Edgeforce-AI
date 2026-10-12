import {appendD1Observations,type D1Database,type D1Observation} from './d1-observations';
import {scoreboardSource} from '../src/lib/intelligence-core/score-source-catalog.mjs';
type Env={CRON_SECRET?:string;INTELLIGENCE_DB?:D1Database;SPORTS_SCORE_COLLECT_ENABLED?:string};
const headers={'Cache-Control':'no-store'};
export async function collectMultiSportScores(request:Request,env:Env):Promise<Response>{
 if(request.method!=='POST')return new Response(null,{status:405,headers:{Allow:'POST'}});
 if(!env.CRON_SECRET||request.headers.get('authorization')!==`Bearer ${env.CRON_SECRET}`)
  return Response.json({ok:false,reason:'UNAUTHORIZED'},{status:401,headers});
 if(env.SPORTS_SCORE_COLLECT_ENABLED!=='true')
  return Response.json({ok:false,reason:'COLLECTION_DISABLED'},{status:503,headers});
 if(!env.INTELLIGENCE_DB?.prepare)return Response.json({ok:false,reason:'D1_BINDING_MISSING'},{status:503,headers});
 const url=new URL(request.url);
 let source:ReturnType<typeof scoreboardSource>;
 try{source=scoreboardSource(url.searchParams.get('sport')||'');}
 catch{return Response.json({ok:false,reason:'SPORT_NOT_APPROVED'},{status:400,headers});}
 try{
  const registration=await env.INTELLIGENCE_DB.prepare('SELECT upstream_id FROM intelligence_sources WHERE source_id=? AND enabled=1').bind(source.sourceId).first<{upstream_id:string}>();
  if(!registration||registration.upstream_id!==source.upstreamId)
   return Response.json({ok:false,reason:'SOURCE_NOT_APPROVED'},{status:403,headers});
  const upstream=await fetch(source.endpoint,{signal:AbortSignal.timeout(6500),headers:{Accept:'application/json'}});
  if(!upstream.ok)return Response.json({ok:false,reason:'SOURCE_UNAVAILABLE'},{status:503,headers});
  const raw=await upstream.text();
  if(new TextEncoder().encode(raw).length>250000)return Response.json({ok:false,reason:'SOURCE_TOO_LARGE'},{status:503,headers});
  const data=JSON.parse(raw) as {events?:Array<{id?:string;date?:string;status?:{type?:{name?:string}};competitions?:Array<{competitors?:Array<{team?:{displayName?:string};score?:string}>}>}>};
  const events=Array.isArray(data.events)?data.events.slice(0,15):[];
  const observedAt=Date.now();
  const observations:D1Observation[]=[];
  for(const event of events){
   const competitors=event.competitions?.[0]?.competitors?.slice(0,2)||[];
   if(typeof event.id!=='string'||!event.id||competitors.length!==2||
     competitors.some(x=>typeof x.score!=='string'||!/^\\d{1,3}$/.test(x.score)))continue;
   observations.push({provider:source.sourceId,upstreamId:source.upstreamId,eventId:event.id,observedAt,
    kind:'score',value:{sport:source.sport,sourceEventId:event.id,eventDate:event.date||null,
      status:event.status?.type?.name||null,teams:competitors.map(x=>({name:x.team?.displayName||null,score:x.score})),
      observationTimeIsCollectionTime:true}});
  }
  const report=await appendD1Observations(env.INTELLIGENCE_DB,observations,observedAt);
  return Response.json({ok:report.rejected===0,source:source.sourceId,sport:source.sport,
   classification:source.classification,attempted:observations.length,fetchedEvents:events.length,...report},{headers,status:report.rejected===0?200:503});
 }catch{return Response.json({ok:false,reason:'SCORE_COLLECTION_FAILED'},{status:503,headers});}
}
