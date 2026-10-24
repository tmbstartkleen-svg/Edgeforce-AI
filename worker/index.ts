import handler from 'vinext/server/fetch-handler';
import {atlasGateway} from './atlas-mission-gateway';
import {d1CoverageGateway} from './d1-coverage';
import {d1RemoteOperationsDashboard} from './d1-remote-operations-dashboard';
import {d1OddsSourceRegistry} from './d1-odds-source-registry';
import {d1SportsbookOpportunityReview} from './d1-sportsbook-opportunity-review';
import {predictionCatalogGateway} from './prediction-public-catalog';
import {predictionOrderbookGateway} from './prediction-orderbook-review';
export {AtlasMissionRoom} from './atlas-mission-room';
import {kalshiConnectionDiagnostic} from './kalshi-connection-diagnostic';
import {d1PilotReadiness} from './d1-pilot';
import {d1RuntimeHealth} from './d1-runtime-health';
import {d1SchemaInspection} from './d1-schema-inspection';
import {d1DataReadiness} from './d1-data-readiness';
import {d1ReferenceIngest} from './d1-reference-ingest';
import {d1ReferenceIngestStatus} from './d1-reference-ingest-status';
import {d1IngestGateway,d1RecentGateway} from './d1-gateway';
import {d1SportsMarketArchiveIngest,d1SportsMarketArchiveReadiness} from './d1-sports-archive-gateway';
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
 if(minute===53)return callScheduledRoute('/api/cron/slo-governor',runSloCron,env,'CRON_SECRET');
 if(minute===54)return callScheduledRoute('/api/cron/topology-watchdog',runTopologyCron,env,'CRON_SECRET');
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
  const pathname=new URL(request.url).pathname;
  if(pathname==='/api/operations/prediction-orderbooks')return predictionOrderbookGateway(request,env);
  if(pathname==='/api/operations/prediction-catalog')return predictionCatalogGateway(request,env);
  if(pathname==='/api/operations/sportsbook-opportunities')return d1SportsbookOpportunityReview(request,env);
  if(pathname==='/api/operations/odds-source-registry')return d1OddsSourceRegistry(request,env);
  if(pathname==='/api/operations/remote-dashboard')return d1RemoteOperationsDashboard(request,env);
  if(pathname==='/api/operations/kalshi/connection')return kalshiConnectionDiagnostic(request,env);
  if(pathname==='/api/operations/d1-pilot/reference-ingest/status')return d1ReferenceIngestStatus(request,env);
  if(pathname==='/api/operations/d1-pilot/reference-ingest')return d1ReferenceIngest(request,env);
  if(pathname==='/api/operations/d1-pilot/data-readiness')return d1DataReadiness(request,env);
  if(pathname==='/api/operations/d1-pilot/schema')return d1SchemaInspection(request,env);
  if(pathname==='/api/operations/d1-pilot/health')return d1RuntimeHealth(request,env);
  if(pathname==='/api/operations/d1-pilot/ingest')return d1IngestGateway(request,env);
  if(pathname==='/api/operations/d1-pilot/recent')return d1RecentGateway(request,env);
  if(pathname==='/api/operations/d1-pilot/coverage')return d1CoverageGateway(request,env);
  if(pathname==='/api/operations/d1-pilot/sports-market-ingest')return d1SportsMarketArchiveIngest(request,env);
  if(pathname==='/api/operations/d1-pilot/sports-market-readiness')return d1SportsMarketArchiveReadiness(request,env);
  if(pathname==='/api/operations/d1-pilot/readiness'){
   if(request.method!=='GET')return Promise.resolve(new Response(null,{status:405,headers:{Allow:'GET'}}));
   return d1PilotReadiness(request,env);
  }
  if(pathname==='/api/network/missions'||pathname==='/api/network/tasks'||pathname==='/api/network/staging-certification'||(pathname==='/api/network/director'&&request.method==='POST')){
   return atlasGateway(request,env as Parameters<typeof atlasGateway>[1],forwarded=>
    withDatabaseScope(scoped=>handler.fetch(forwarded,env as any,scoped as any),env,ctx));
  }
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
