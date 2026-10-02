import {db} from './db';
import {evaluateReadiness} from './readiness';
import {RELEASE} from './releaseManifest';

export async function getOpsStatus(){
 const readiness=await evaluateReadiness();
 const sql=db();
 const base={
  ok:true,
  build:RELEASE.build,
  version:RELEASE.appVersion,
  modelVersion:RELEASE.modelVersion,
  migrationVersion:RELEASE.migrationVersion,
  readiness,
  deployment:{
   vercel:Boolean(process.env.VERCEL),
   environment:process.env.VERCEL_ENV||'local',
   url:process.env.VERCEL_URL||null,
   commit:process.env.VERCEL_GIT_COMMIT_SHA||null,
   projectId:process.env.VERCEL_PROJECT_ID||null
  },
  uptimeSeconds:Math.round(process.uptime()),
  memory:process.memoryUsage(),
  time:new Date().toISOString()
 };
 if(!sql)return {...base,source:'memory',heartbeats:[],attestations:[],incidents:[],performance:[]};
 try{
  const [heartbeats,attestations,incidents,performance]=await Promise.all([
   sql`select version,environment,ready,production_ready as "productionReady",odds_operational as "oddsOperational",required_failures as "requiredFailures",commit_sha as "commitSha",created_at as "createdAt" from operational_heartbeats order by created_at desc limit 20`,
   sql`select id,version,commit_sha as "commitSha",environment,migration_version as "migrationVersion",build_passed as "buildPassed",smoke_passed as "smokePassed",load_passed as "loadPassed",readiness_passed as "readinessPassed",metadata,created_at as "createdAt" from release_attestations order by created_at desc limit 20`,
   sql`select id,severity,event_type as "eventType",message,request_id as "requestId",metadata,created_at as "createdAt",resolved_at as "resolvedAt" from runtime_incidents where resolved_at is null order by created_at desc limit 20`,
   sql`select route,count(*)::int as samples,avg(duration_ms)::float as "avgMs",percentile_cont(0.95) within group(order by duration_ms)::float as "p95Ms",max(duration_ms)::float as "maxMs" from performance_samples where created_at>=now()-interval '24 hours' group by route order by "p95Ms" desc limit 20`
  ]);
  return {...base,source:'database',heartbeats,attestations,incidents,performance};
 }catch(error){
  return {...base,source:'database',heartbeats:[],attestations:[],incidents:[],performance:[],error:error instanceof Error?error.message:'ops status failed'};
 }
}
