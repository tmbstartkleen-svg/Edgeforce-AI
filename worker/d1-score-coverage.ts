type DB={prepare(sql:string):{all():Promise<{results:Record<string,unknown>[]}>}};
type Env={CRON_SECRET?:string;INTELLIGENCE_DB?:DB};
export async function d1ScoreCoverage(request:Request,env:Env):Promise<Response>{
 const headers={'Cache-Control':'no-store'};
 if(request.method!=='GET')return new Response(null,{status:405,headers:{Allow:'GET'}});
 if(!env.CRON_SECRET||request.headers.get('authorization')!==`Bearer ${env.CRON_SECRET}`)
  return Response.json({ok:false,reason:'UNAUTHORIZED'},{status:401,headers});
 if(!env.INTELLIGENCE_DB?.prepare)return Response.json({ok:false,reason:'D1_BINDING_MISSING'},{status:503,headers});
 try{
  const res=await env.INTELLIGENCE_DB.prepare(`SELECT o.source_id,COUNT(*) AS total,
   COUNT(DISTINCT o.event_id) AS events,MAX(o.observed_at) AS latest_observed_at
   FROM intelligence_observations o JOIN intelligence_sources s
     ON s.source_id=o.source_id AND s.upstream_id=o.upstream_id AND s.enabled=1
   WHERE o.observation_kind='score' AND o.source_id LIKE 'espn-scoreboard-%'
   GROUP BY o.source_id ORDER BY o.source_id LIMIT 30`).all();
  const sources=res.results.map(x=>({sourceId:x.source_id,observations:Number(x.total??0),
   distinctEvents:Number(x.events??0),latestObservedAt:x.latest_observed_at}));
  return Response.json({ok:true,store:'D1',classification:'SCORES_NOT_ODDS',sources,
   totalObservedScores:sources.reduce((n,x)=>n+x.observations,0),
   independentSportsbookOddsCertified:false,sourceUsageRightsCertified:false,
   automatedCollectionCertified:false,historicalNeonParityCertified:false},{headers});
 }catch{return Response.json({ok:false,reason:'D1_SCORE_COVERAGE_UNAVAILABLE'},{status:503,headers});}
}
