import type {D1Database} from './d1-observations';
import {scoreSports,scoreboardSource} from '../src/lib/intelligence-core/score-source-catalog.mjs';
type Env={CRON_SECRET?:string;INTELLIGENCE_DB?:D1Database};
const headers={'Cache-Control':'no-store'};
/**
 * Phase 2 read-only scoreboard history audit.
 * Retains source evidence and ingestion freshness, never infers odds, results or model probabilities.
 */
export async function scoreHistoryAudit(request:Request,env:Env):Promise<Response>{
 if(request.method!=='GET')return new Response(null,{status:405,headers:{...headers,Allow:'GET'}});
 if(typeof env.CRON_SECRET!=='string'||env.CRON_SECRET.length<24||request.headers.get('authorization')!==`Bearer ${env.CRON_SECRET}`)
  return Response.json({ok:false,reason:'UNAUTHORIZED'},{status:401,headers});
 if(!env.INTELLIGENCE_DB?.prepare)return Response.json({ok:false,reason:'D1_BINDING_MISSING'},{status:503,headers});
 const params=new URL(request.url).searchParams;
 const sport=params.get('sport');
 if(sport&&!scoreSports.some(s=>s.id===sport))return Response.json({ok:false,reason:'SPORT_NOT_APPROVED'},{status:400,headers});
 const hoursText=params.get('hours')||'168',hours=Number(hoursText);
 if(!Number.isInteger(hours)||hours<1||hours>720)return Response.json({ok:false,reason:'INVALID_HISTORY_WINDOW'},{status:400,headers});
 const since=new Date(Date.now()-hours*3600000).toISOString();
 const sources=(sport?[sport]:scoreSports.map(s=>s.id)).map(scoreboardSource);
 try{
  const rows=await env.INTELLIGENCE_DB.prepare(
   `SELECT source_id,COUNT(*) AS observations,COUNT(DISTINCT event_id) AS distinct_events,
    MAX(ingested_at) AS last_ingested_at,MIN(ingested_at) AS first_ingested_at
    FROM intelligence_observations WHERE observation_kind='score'
      AND ingested_at>=? AND source_id LIKE 'espn-scoreboard-%'
    GROUP BY source_id`
  ).bind(since).all<{source_id:string;observations:number;distinct_events:number;last_ingested_at:string;first_ingested_at:string}>();
  const matched=new Map(rows.results.map(r=>[r.source_id,r]));
  const bySport=sources.map(s=>{
   const r=matched.get(s.sourceId);
   return {sport:s.sport,sourceId:s.sourceId,observations:r?.observations||0,distinctEvents:r?.distinct_events||0,
    firstIngestedAt:r?.first_ingested_at||null,lastIngestedAt:r?.last_ingested_at||null,
    actualPersistedEvidence:!!r?.observations};
  });
  return Response.json({ok:true,mode:'READ_ONLY_SCORE_HISTORY_AUDIT',classification:'SCORES_NOT_ODDS',
   hours,since,sourceCount:bySport.length,coveredSources:bySport.filter(x=>x.actualPersistedEvidence).length,
   totalScoreObservations:bySport.reduce((n,s)=>n+s.observations,0),bySport,
   oddsCertified:false,playerStatsCertified:false,predictionsCertified:false,
   warning:'Historical count only. Source timestamps are not independently verified game results. No betting prices, simulations or settlement are inferred.'},{headers});
 }catch{return Response.json({ok:false,reason:'HISTORY_READ_FAILED'},{status:503,headers});}
}
