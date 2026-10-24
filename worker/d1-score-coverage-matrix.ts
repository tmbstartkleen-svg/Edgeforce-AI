import type {D1Database} from './d1-observations';
import {scoreSports,scoreboardSource} from '../src/lib/intelligence-core/score-source-catalog.mjs';
type Env={CRON_SECRET?:string;INTELLIGENCE_DB?:D1Database};
const headers={'Cache-Control':'no-store'};
/** Authenticated, bounded evidence matrix. All coverage claims require stored source records. */
export async function scoreCoverageMatrix(request:Request,env:Env):Promise<Response>{
 if(request.method!=='GET')return new Response(null,{status:405,headers:{...headers,Allow:'GET'}});
 if(!env.CRON_SECRET||request.headers.get('authorization')!==`Bearer ${env.CRON_SECRET}`)
  return Response.json({ok:false,reason:'UNAUTHORIZED'},{status:401,headers});
 if(!env.INTELLIGENCE_DB?.prepare)return Response.json({ok:false,reason:'D1_BINDING_MISSING'},{status:503,headers});
 const hours=Number(new URL(request.url).searchParams.get('hours')||168);
 if(!Number.isInteger(hours)||hours<1||hours>720)return Response.json({ok:false,reason:'INVALID_WINDOW'},{status:400,headers});
 const since=new Date(Date.now()-hours*3600000).toISOString();
 try{
  const rows=await env.INTELLIGENCE_DB.prepare(`SELECT source_id,COUNT(*) AS n,COUNT(DISTINCT event_id) AS games,
   MAX(ingested_at) AS latest FROM intelligence_observations
   WHERE observation_kind='score' AND ingested_at>=? GROUP BY source_id`).bind(since).all<{source_id:string;n:number;games:number;latest:string}>();
  const map=new Map(rows.results.map(r=>[r.source_id,r]));
  const sports=scoreSports.map(s=>{
   const sourceId=scoreboardSource(s.id).sourceId,r=map.get(sourceId);
   const count=Number(r?.n||0),events=Number(r?.games||0),latest=r?.latest||null;
   const ageMinutes=latest?Math.max(0,Math.round((Date.now()-Date.parse(latest))/60000)):null;
   return {sport:s.id,label:s.label,sourceId,registered:true,persistedObservations:count,distinctEvents:events,
    latestIngestedAt:latest,ageMinutes,hasPersistedEvidence:count>0,
    freshness:count===0?'NO_DATA':ageMinutes===null||!Number.isFinite(ageMinutes)?'UNKNOWN':ageMinutes<=60?'RECENT':ageMinutes<=1440?'AGING':'STALE',
    verifiedOdds:false,verifiedPlayerStats:false,verifiedPredictions:false};
  });
  return Response.json({ok:true,mode:'PERSISTED_SCORE_COVERAGE_MATRIX',classification:'SCORES_NOT_ODDS',hours,
   registeredSources:sports.length,sourcesWithPersistedEvidence:sports.filter(x=>x.hasPersistedEvidence).length,
   totalScoreObservations:sports.reduce((n,x)=>n+x.persistedObservations,0),
   scores:sports,warning:'Evidence reflects isolated D1 scoreboard observations only, not full DraftKings market coverage.'},{headers});
 }catch{return Response.json({ok:false,reason:'COVERAGE_QUERY_FAILED'},{status:503,headers});}
}
