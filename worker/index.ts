import handler from 'vinext/server/fetch-handler';

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
 const response=await handler.fetch(request,env as any,ctx as any);
 if(!response.ok){
  const body=await response.text().catch(()=>'');
  throw new Error(`${path} failed with ${response.status}${body?`: ${body.slice(0,240)}`:''}`);
 }
 return response;
}

async function runHourly(env:EdgeforceEnv,ctx:ExecutionContextLike){
 await callInternal('/api/cron/scan',env,ctx,'CRON_SECRET');
 await Promise.all([
  callInternal('/api/cron/decision',env,ctx,'CRON_SECRET'),
  callInternal('/api/cron/settle',env,ctx,'CRON_SECRET'),
  callInternal('/api/cron/heartbeat',env,ctx,'CRON_SECRET'),
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
  return handler.fetch(request,env as any,ctx as any);
 },
 async scheduled(controller:ScheduledControllerLike,env:EdgeforceEnv,ctx:ExecutionContextLike){
  const task=controller.cron==='15 6 * * *'?runDaily(env,ctx):runHourly(env,ctx);
  ctx.waitUntil(task);
 },
};

export default worker;
