import {scoreboardSource} from '../src/lib/intelligence-core/score-source-catalog.mjs';
import type {D1Database} from './d1-observations';
type Env={CRON_SECRET?:string;INTELLIGENCE_DB?:D1Database};
const headers={'Cache-Control':'no-store'};
/** Real upstream diagnostics without D1 mutations. Scoreboard records are NOT betting odds. */
export async function probeScoreSource(request:Request,env:Env):Promise<Response>{
 if(request.method!=='GET')return new Response(null,{status:405,headers:{...headers,Allow:'GET'}});
 if(typeof env.CRON_SECRET!=='string'||env.CRON_SECRET.length<24||request.headers.get('authorization')!==`Bearer ${env.CRON_SECRET}`)
  return Response.json({ok:false,reason:'UNAUTHORIZED'},{status:401,headers});
 if(!env.INTELLIGENCE_DB?.prepare)return Response.json({ok:false,reason:'D1_BINDING_MISSING'},{status:503,headers});
 let source:ReturnType<typeof scoreboardSource>;
 try{source=scoreboardSource(new URL(request.url).searchParams.get('sport')||'');}
 catch{return Response.json({ok:false,reason:'SPORT_NOT_APPROVED'},{status:400,headers});}
 try{
  const registration=await env.INTELLIGENCE_DB.prepare('SELECT upstream_id FROM intelligence_sources WHERE source_id=? AND enabled=1').bind(source.sourceId).first<{upstream_id:string}>();
  if(registration?.upstream_id!==source.upstreamId)return Response.json({ok:false,reason:'SOURCE_NOT_APPROVED'},{status:403,headers});
  const response=await fetch(source.endpoint,{signal:AbortSignal.timeout(6500),headers:{Accept:'application/json'}});
  if(!response.ok)return Response.json({ok:false,reason:'UPSTREAM_HTTP_FAILURE',status:response.status},{status:502,headers});
  const raw=await response.text();
  if(new TextEncoder().encode(raw).length>250000)return Response.json({ok:false,reason:'UPSTREAM_TOO_LARGE'},{status:502,headers});
  const parsed=JSON.parse(raw) as {events?:Array<{id?:unknown;status?:{type?:{name?:unknown}};competitions?:Array<{competitors?:Array<{score?:unknown}>}>}>};
  if(!Array.isArray(parsed.events))return Response.json({ok:false,reason:'INVALID_SCOREBOARD_PAYLOAD'},{status:502,headers});
  let scheduled=0,scored=0,invalid=0;
  for(const event of parsed.events.slice(0,15)){
   const players=event.competitions?.[0]?.competitors;
   if(typeof event.id!=='string'||!event.id||!Array.isArray(players)||players.length!==2){invalid++;continue;}
   if(event.status?.type?.name==='STATUS_SCHEDULED'){scheduled++;continue;}
   if(players.every(p=>typeof p.score==='string'&&/^\d{1,3}$/.test(p.score))){scored++;continue;}
   invalid++;
  }
  if(scheduled+scored===0)return Response.json({ok:false,reason:'NO_QUALIFYING_UPSTREAM_EVENTS',source:source.sourceId,classification:'SCORES_NOT_ODDS',receivedEvents:parsed.events.length,inspectedEvents:Math.min(15,parsed.events.length),invalidEvents:invalid,scheduled:0,scored:0,persisted:false,diagnostic:'EMPTY_OR_UNSUPPORTED_SCOREBOARD; do not certify ingestion; check schedule window and event status'},{status:422,headers});
  return Response.json({ok:true,mode:'REAL_UPSTREAM_READ_ONLY_PROBE',source:source.sourceId,classification:'SCORES_NOT_ODDS',
    receivedEvents:parsed.events.length,inspectedEvents:Math.min(15,parsed.events.length),qualifyingSchedules:scheduled,qualifyingScores:scored,invalidEvents:invalid,
    collectedAt:new Date().toISOString(),persisted:false,warning:'Read-only upstream probe. No database writes, odds, or betting recommendations.'},{headers});
 }catch{return Response.json({ok:false,reason:'UPSTREAM_PROBE_FAILED'},{status:503,headers});}
}
