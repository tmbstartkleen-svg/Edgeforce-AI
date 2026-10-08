import handler from 'vinext/server/fetch-handler';
import {withDatabaseScope} from '../src/lib/db';
import {GET as runInjuryCron} from '../src/app/api/cron/injuries/route';
import {GET as runScanCron} from '../src/app/api/cron/scan/route';
import {GET as runDecisionCron} from '../src/app/api/cron/decision/route';
import {GET as runSettleCron} from '../src/app/api/cron/settle/route';
import {GET as runHeartbeatCron} from '../src/app/api/cron/heartbeat/route';
import {GET as runPredictionCron} from '../src/app/api/cron/predictions/route';
import {GET as runSloCron} from '../src/app/api/cron/slo-governor/route';
import {GET as runTopologyCron} from '../src/app/api/cron/topology-watchdog/route';
import {GET as runRecalibrateCron} from '../src/app/api/cron/recalibrate/route';
import {POST as runProviderCertification} from '../src/app/api/providers/certify/route';

type EdgeforceEnv={
 CRON_SECRET?:string;
 INGEST_SECRET?:string;
 [key:string]:unknown;
};

type ScheduledControllerLike={
 cron:string;
 scheduledTime:number;
};

type ExecutionContextLike={
 waitUntil(promise:Promise<unknown>):void;
};

type ScheduledRoute=(request:Request)=>Promise<Response>;

async function callScheduledRoute(
 path:string,
 route:ScheduledRoute,
 env:EdgeforceEnv,
 secretName:'CRON_SECRET'|'INGEST_SECRET',
 options:{method?:'GET'|'POST';allowStatuses?:number[]}={}
){
 const secret=String(env[secretName]||'');
 const request=new Request(`https://edgeforce.internal${path}`,{
  method:options.method||'GET',
  headers:secret?{authorization:`Bearer ${secret}`}:{},
 });
 const response=await route(request);
 const body=await response.text();
 const allowed=options.allowStatuses||[];
 if(!response.ok&&!allowed.includes(response.status)){
  throw new Error(`${path} failed with ${response.status}${body?`: ${body.slice(0,240)}`:''}`);
 }
 return {status:response.status};
}

async function runInjuries(env:EdgeforceEnv){
 await callScheduledRoute('/api/cron/injuries',runInjuryCron,env,'CRON_SECRET');
}

async function runHourlyShard(controller:ScheduledControllerLike,env:EdgeforceEnv){
 const minute=new Date(controller.scheduledTime).getUTCMinutes();
 if(minute===3)return callScheduledRoute('/api/cron/scan',runScanCron,env,'CRON_SECRET');
 if(minute===13)return callScheduledRoute('/api/cron/decision',runDecisionCron,env,'CRON_SECRET');
 if(minute===23)return callScheduledRoute('/api/cron/settle',runSettleCron,env,'CRON_SECRET');
 if(minute===33)return callScheduledRoute('/api/cron/predictions',runPredictionCron,env,'CRON_SECRET');
 if(minute===43)return callScheduledRoute('/api/cron/heartbeat',runHeartbeatCron,env,'CRON_SECRET');
 if(minute===53){
  await callScheduledRoute('/api/cron/slo-governor',runSloCron,env,'CRON_SECRET');
  return callScheduledRoute('/api/cron/topology-watchdog',runTopologyCron,env,'CRON_SECRET');
 }
}

async function runDailyShard(controller:ScheduledControllerLike,env:EdgeforceEnv){
 const minute=new Date(controller.scheduledTime).getUTCMinutes();
 if(minute===15)return callScheduledRoute('/api/cron/recalibrate',runRecalibrateCron,env,'CRON_SECRET');
 if(minute===45){
  return callScheduledRoute('/api/providers/certify',runProviderCertification,env,'INGEST_SECRET',{
   method:'POST',
   allowStatuses:[422]
  });
 }
}

const worker={
 fetch(request:Request,env:EdgeforceEnv,ctx:ExecutionContextLike){
  return withDatabaseScope(scoped=>handler.fetch(request,env as any,scoped as any),env,ctx);
 },
 async scheduled(controller:ScheduledControllerLike,env:EdgeforceEnv,ctx:ExecutionContextLike){
  const task=withDatabaseScope(async()=>{
   if(controller.cron==='*/15 * * * *')return runInjuries(env);
   if(controller.cron==='3,13,23,33,43,53 * * * *')return runHourlyShard(controller,env);
   if(controller.cron==='15,45 6 * * *')return runDailyShard(controller,env);
  },env,ctx);
  ctx.waitUntil(task);
 },
};

export default worker;
