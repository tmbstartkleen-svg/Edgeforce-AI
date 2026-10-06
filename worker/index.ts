import handler from 'vinext/server/fetch-handler';
import {withDatabaseScope} from '../src/lib/db';

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

async function callInternal(path:string,env:EdgeforceEnv,ctx:ExecutionContextLike,secretName:'CRON_SECRET'|'INGEST_SECRET'){
 const secret=String(env[secretName]||'');
 const request=new Request(`https://edgeforce.internal${path}`,{
  method:path.startsWith('/api/providers/certify')?'POST':'GET',
  headers:secret?{authorization:`Bearer ${secret}`}:{},
 });
 // Keep every in-flight internal route in the scheduled invocation's lifetime,
 // even if a sibling fails first. All routes share only this invocation's pool.
 const task=(async()=>{
  const response=await handler.fetch(request,env as any,ctx as any);
  const body=await response.text();
  if(!response.ok){
   throw new Error(`${path} failed with ${response.status}${body?`: ${body.slice(0,240)}`:''}`);
  }
  return {status:response.status};
 })();
 ctx.waitUntil(task);
 return task;
}

async function runInjuries(env:EdgeforceEnv,ctx:ExecutionContextLike){
 await callInternal('/api/cron/injuries',env,ctx,'CRON_SECRET');
}

async function runHourly(env:EdgeforceEnv,ctx:ExecutionContextLike){
 await callInternal('/api/cron/scan',env,ctx,'CRON_SECRET');
 await Promise.all([
  callInternal('/api/cron/decision',env,ctx,'CRON_SECRET'),
  callInternal('/api/cron/settle',env,ctx,'CRON_SECRET'),
  callInternal('/api/cron/heartbeat',env,ctx,'CRON_SECRET'),
  callInternal('/api/cron/predictions',env,ctx,'CRON_SECRET'),
  callInternal('/api/cron/slo-governor',env,ctx,'CRON_SECRET'),
 ]);
}

async function runDaily(env:EdgeforceEnv,ctx:ExecutionContextLike){
 await Promise.all([
  callInternal('/api/cron/recalibrate',env,ctx,'CRON_SECRET'),
  callInternal('/api/providers/certify',env,ctx,'INGEST_SECRET'),
 ]);
}

const worker={
 fetch(request:Request,env:EdgeforceEnv,ctx:ExecutionContextLike){
  return withDatabaseScope(scoped=>handler.fetch(request,env as any,scoped as any),env,ctx);
 },
 async scheduled(controller:ScheduledControllerLike,env:EdgeforceEnv,ctx:ExecutionContextLike){
  const task=withDatabaseScope(scoped=>
   controller.cron==='15 6 * * *'?runDaily(env,scoped):controller.cron==='*/15 * * * *'?runInjuries(env,scoped):runHourly(env,scoped),
   env,ctx
  );
  ctx.waitUntil(task);
 },
};

export default worker;
