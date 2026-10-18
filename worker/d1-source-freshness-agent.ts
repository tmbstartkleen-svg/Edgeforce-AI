// Read-only source freshness assessment for the isolated D1 pilot.
// This never fetches upstream odds, schedules jobs, or authorizes bets/cutover.
type Db={prepare(sql:string):{all<T>():Promise<{results:T[]}>}};
type Env={INTELLIGENCE_DB?:Db;CRON_SECRET?:string};
type SourceRow={source_id:string;upstream_id:string;source_type:string;enabled:number;observations:number;latest_at:string|null};
export async function assessSourceFreshness(env:Env,now=Date.now()){
 if(!env.INTELLIGENCE_DB)return {ok:false,reason:'D1_BINDING_MISSING',cutoverAuthorized:false};
 const query=`SELECT s.source_id,s.upstream_id,s.source_type,s.enabled,
 COUNT(o.observation_id) AS observations, MAX(o.observed_at) AS latest_at
 FROM intelligence_sources s LEFT JOIN intelligence_observations o
 ON o.source_id=s.source_id
 GROUP BY s.source_id,s.upstream_id,s.source_type,s.enabled ORDER BY s.source_id LIMIT 100`;
 const data=await env.INTELLIGENCE_DB.prepare(query).all<SourceRow>();
 const sources=(data.results||[]).map(row=>{
  const observed=row.latest_at?Date.parse(row.latest_at):NaN;
  const ageMinutes=Number.isFinite(observed)?Math.max(0,Math.round((now-observed)/60000)):null;
  const enabled=row.enabled===1;
  const status=!enabled?'DISABLED':ageMinutes===null?'NO_OBSERVATIONS':observed>now+60000?'FUTURE_TIMESTAMP':ageMinutes>30?'STALE':'RECENT';
  return {sourceId:row.source_id,upstreamId:row.upstream_id,sourceType:row.source_type,
   enabled,observations:Number(row.observations)||0,ageMinutes,status};
 });
 return {ok:true,mode:'READ_ONLY',sourceCount:sources.length,
  healthyEnabled:sources.filter(s=>s.enabled&&s.status==='RECENT').length,
  staleEnabled:sources.filter(s=>s.enabled&&s.status!=='RECENT').length,
  sources,upstreamsIndependentlyAuthenticated:false,modelProbabilityVerified:false,cutoverAuthorized:false};
}
export async function sourceFreshnessRoute(request:Request,env:Env){
 if(request.method!=='GET')return Response.json({ok:false,reason:'METHOD_NOT_ALLOWED'},{status:405});
 if(!env.CRON_SECRET||env.CRON_SECRET.length<32||
 request.headers.get('Authorization')!==`Bearer ${env.CRON_SECRET}`)
  return Response.json({ok:false,reason:'UNAUTHORIZED'},{status:401});
 try{return Response.json(await assessSourceFreshness(env),{headers:{'Cache-Control':'no-store'}});}
 catch{return Response.json({ok:false,reason:'FRESHNESS_AUDIT_UNAVAILABLE',cutoverAuthorized:false},{status:503});}
}
