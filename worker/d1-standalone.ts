import {d1PilotReadiness} from './d1-pilot';
import {d1IngestGateway,d1RecentGateway} from './d1-gateway';
import {certifyD1Persistence} from './d1-persistence-cert';
import {d1WorkspaceSummary} from './d1-workspaces';
type Env={CRON_SECRET?:string;INGEST_SECRET?:string;INTELLIGENCE_D1_WRITE_ENABLED?:string;INTELLIGENCE_DB?:unknown};
export default {
 fetch(request:Request,env:Env):Promise<Response>{
  const pathname=new URL(request.url).pathname;
  if(pathname==='/api/intelligence/workspaces/summary')return d1WorkspaceSummary(request,env);
  if(pathname==='/api/operations/d1-pilot/certify-persistence')return certifyD1Persistence(request,env);
  if(pathname==='/api/operations/d1-pilot/readiness')return d1PilotReadiness(request,env);
  if(pathname==='/api/operations/d1-pilot/recent')return d1RecentGateway(request,env);
  if(pathname==='/api/operations/d1-pilot/ingest')return d1IngestGateway(request,env);
  return Promise.resolve(Response.json({ok:false,reason:'NOT_FOUND'}, {status:404}));
 }
};
