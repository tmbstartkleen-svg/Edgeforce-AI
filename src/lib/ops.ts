import {db} from './db';
import {logEvent} from './observability';
import {RELEASE} from './releaseManifest';

const sampleRate=()=>{
 const n=Number(process.env.PERFORMANCE_SAMPLE_RATE||.10);
 return Number.isFinite(n)?Math.max(0,Math.min(1,n)):.10;
};

export async function recordPerformance(route:string,durationMs:number,statusCode:number,providerId?:string){
 logEvent(statusCode>=500?'error':durationMs>1500?'warn':'info','http.performance',{
  route,durationMs,statusCode,providerId:providerId||null
 });
 if(Math.random()>sampleRate())return;
 const sql=db();
 if(!sql)return;
 await sql`
  insert into performance_samples(route,duration_ms,status_code,provider_id,created_at)
  values(${route},${durationMs},${statusCode},${providerId??null},now())
 `.catch(()=>undefined);
}

export async function recordIncident(
 severity:'INFO'|'WATCH'|'ACTION',
 eventType:string,
 message:string,
 metadata:Record<string,unknown>={},
 requestId?:string
){
 logEvent(severity==='ACTION'?'error':severity==='WATCH'?'warn':'info','runtime.incident',{
  severity,eventType,message,requestId:requestId||null,...metadata
 });
 const sql=db();
 if(!sql)return;
 await sql`
  insert into runtime_incidents(severity,event_type,message,request_id,metadata,created_at)
  values(${severity},${eventType},${message},${requestId??null},${sql.json({...metadata,release:RELEASE.appVersion})},now())
 `.catch(()=>undefined);
}

export async function recordHeartbeat(readiness:{ready:boolean;productionReady:boolean;environment:string;requiredFailures:string[];providers:{oddsOperational:number}}){
 const sql=db();
 if(!sql)return;
 await sql`
  insert into operational_heartbeats(
   version,environment,ready,production_ready,odds_operational,required_failures,commit_sha,created_at
  ) values(
   ${RELEASE.appVersion},${readiness.environment},${readiness.ready},${readiness.productionReady},
   ${readiness.providers.oddsOperational},${sql.json(readiness.requiredFailures)},
   ${process.env.VERCEL_GIT_COMMIT_SHA||null},now()
  )
 `.catch(()=>undefined);
}
