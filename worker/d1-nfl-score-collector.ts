import {appendD1Observations,type D1Database,type D1Observation} from './d1-observations';

type Env={CRON_SECRET?:string;INTELLIGENCE_DB?:D1Database;SPORTS_SCORE_COLLECT_ENABLED?:string};
const endpoint='https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard';
const headers={'Cache-Control':'no-store'};
export async function collectNflScores(request:Request,env:Env):Promise<Response>{
 if(request.method!=='POST')return new Response(null,{status:405,headers:{Allow:'POST'}});
 if(!env.CRON_SECRET||request.headers.get('authorization')!==`Bearer ${env.CRON_SECRET}`)
  return Response.json({ok:false,reason:'UNAUTHORIZED'},{status:401,headers});
 if(env.SPORTS_SCORE_COLLECT_ENABLED!=='true')
  return Response.json({ok:false,reason:'COLLECTION_DISABLED'},{status:503,headers});
 if(!env.INTELLIGENCE_DB?.prepare)return Response.json({ok:false,reason:'D1_BINDING_MISSING'},{status:503,headers});
 // ESPN is a scoreboard source, not an independent sportsbook odds provider.
 try{
  const sourceId='espn-scoreboard-nfl';
  const upstreamId='site.api.espn.com';
  const registry=await env.INTELLIGENCE_DB.prepare('SELECT upstream_id FROM intelligence_sources WHERE source_id=? AND enabled=1').bind(sourceId).first<{upstream_id:string}>();
  if(!registry||registry.upstream_id!==upstreamId)
   return Response.json({ok:false,reason:'SOURCE_NOT_APPROVED'},{status:403,headers});
  const response=await fetch(endpoint,{signal:AbortSignal.timeout(6500),headers:{Accept:'application/json'}});
  if(!response.ok)return Response.json({ok:false,reason:'SOURCE_UNAVAILABLE',httpStatus:response.status},{status:503,headers});
  const body=await response.text();
  if(new TextEncoder().encode(body).length>250000)
   return Response.json({ok:false,reason:'SOURCE_TOO_LARGE'},{status:503,headers});
  const data=JSON.parse(body) as {events?:Array<{id?:string;date?:string;status?:{type?:{name?:string}};competitions?:Array<{competitors?:Array<{team?:{displayName?:string};score?:string}>}>}>};
  const events=Array.isArray(data.events)?data.events.slice(0,15):[];
  const now=Date.now();
  const observations:D1Observation[]=[];
  let skippedWithoutScore=0;
  for(const event of events){
   if(typeof event.id!=='string'||!event.id||!event.competitions?.[0]?.competitors?.length)continue;
   const competitors=event.competitions[0].competitors.slice(0,2);
   if(competitors.length!==2||competitors.some(x=>typeof x.score!=='string'||!/^\\d{1,3}$/.test(x.score))){skippedWithoutScore++;continue;}
   const players=competitors.map(x=>({team:x.team?.displayName||null,score:x.score}));
   observations.push({provider:sourceId,upstreamId,eventId:event.id,observedAt:now,kind:'score',
    value:{sport:'NFL',eventId:event.id,eventDate:event.date||null,status:event.status?.type?.name||null,teams:players,
     source:'ESPN_PUBLIC_SCOREBOARD',observedAt:new Date(now).toISOString()}});
  }
  const report=await appendD1Observations(env.INTELLIGENCE_DB,observations,now);
  return Response.json({ok:true,source:sourceId,kind:'SCORE_ONLY',upstreamOddsProvider:false,observationTimeIsCollectionTime:true,
   fetchedEvents:events.length,attempted:observations.length,skippedWithoutScore,...report},{headers});
 }catch{
  return Response.json({ok:false,reason:'SCORE_COLLECTION_FAILED'},{status:503,headers});
 }
}
