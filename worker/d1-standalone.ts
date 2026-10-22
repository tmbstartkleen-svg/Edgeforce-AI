import {backupReadinessRoute} from './d1-backup-readiness';
import {assessSourceFreshness,sourceFreshnessRoute} from './d1-source-freshness-agent';
import {d1CutoverAuditRoute} from './d1-cutover-audit';
import {inspectStorageSteward,storageStewardRoute} from './d1-storage-steward';
import {d1PilotModelHistory} from './d1-pilot-model-history';
import {d1SportsSchemaCoverage} from './d1-sports-schema-coverage';
import {d1PilotMarketRead} from './d1-pilot-market-read';
import {d1PilotReadiness} from './d1-pilot';
import {d1IngestGateway,d1RecentGateway} from './d1-gateway';
import {certifyD1Persistence} from './d1-persistence-cert';
import {d1WorkspaceSummary} from './d1-workspaces';
import {hostedPolymarketProbe} from './polymarket-probe';
import {d1SportsSnapshots} from './d1-sports-snapshots';
import {d1SportsIngest} from './d1-sports-ingest';
import {sportsCoverageEvidence} from './d1-sports-coverage';
import {collectNflScores} from './d1-nfl-score-collector';
import {collectMultiSportScores} from './d1-multi-sport-collector';
import {probeScoreSource} from './d1-score-source-probe';
import {scoreCollectorReadiness} from './d1-score-collector-readiness';
import {d1ScoreCoverage} from './d1-score-coverage';
type Env={CRON_SECRET?:string;INGEST_SECRET?:string;INTELLIGENCE_D1_WRITE_ENABLED?:string;SPORTS_D1_WRITE_ENABLED?:string;SPORTS_SCORE_COLLECT_ENABLED?:string;STORAGE_STEWARD_SCHEDULE_ENABLED?:string;SOURCE_FRESHNESS_SCHEDULE_ENABLED?:string;INTELLIGENCE_DB?:any};
export default {
 async scheduled(_event:unknown,env:Env,ctx:{waitUntil(promise:Promise<unknown>):void}){
  if(env.STORAGE_STEWARD_SCHEDULE_ENABLED==='true')ctx.waitUntil(inspectStorageSteward(env).then(result=>{
   console.log('EdgeForce storage steward summary',JSON.stringify({ok:result.ok,mode:result.mode}));
  }).catch(()=>console.error('EdgeForce storage steward health probe failed')));
  if(env.SOURCE_FRESHNESS_SCHEDULE_ENABLED==='true')ctx.waitUntil(assessSourceFreshness(env).then(result=>{
   console.log('EdgeForce source freshness summary',JSON.stringify({ok:result.ok,sourceCount:'sourceCount' in result?result.sourceCount:0,staleEnabled:'staleEnabled' in result?result.staleEnabled:0}));
  }).catch(()=>console.error('EdgeForce source freshness probe failed')));
 },
 fetch(request:Request,env:Env):Promise<Response>{
  const pathname=new URL(request.url).pathname;
  if(pathname==='/api/operations/d1-pilot/backup-readiness')return backupReadinessRoute(request,env);
  if(pathname==='/api/operations/d1-pilot/source-freshness')return sourceFreshnessRoute(request,env);
  if(pathname==='/api/operations/d1-pilot/cutover-audit')return d1CutoverAuditRoute(request,env);
  if(pathname==='/api/operations/d1-pilot/storage-steward')return storageStewardRoute(request,env);
  if(pathname==='/api/operations/d1-pilot/schema-coverage')return d1SportsSchemaCoverage(request,env);
  if(pathname==='/api/operations/d1-pilot/model-history')return d1PilotModelHistory(request,env);
  if(pathname==='/api/operations/d1-pilot/market-snapshots')return d1PilotMarketRead(request,env);
  if(pathname==='/api/operations/d1-pilot/score-coverage')return d1ScoreCoverage(request,env);
  if(pathname==='/api/operations/d1-pilot/score-collector-readiness')return scoreCollectorReadiness(request,env);
  if(pathname==='/api/operations/d1-pilot/probe-score-source')return probeScoreSource(request,env);
  if(pathname==='/api/operations/d1-pilot/collect-scores')return collectMultiSportScores(request,env);
  if(pathname==='/api/operations/d1-pilot/collect-nfl-scores')return collectNflScores(request,env);
  if(pathname==='/api/operations/d1-pilot/sports-coverage')return sportsCoverageEvidence(request,env);
  if(pathname==='/api/operations/d1-pilot/sports-ingest')return d1SportsIngest(request,env);
  if(pathname==='/api/operations/d1-pilot/sports-snapshots')return d1SportsSnapshots(request,env);
  if(pathname==='/api/operations/d1-pilot/polymarket-probe')return hostedPolymarketProbe(request,env);
  if(pathname==='/api/intelligence/workspaces/summary')return d1WorkspaceSummary(request,env);
  if(pathname==='/api/operations/d1-pilot/certify-persistence')return certifyD1Persistence(request,env);
  if(pathname==='/api/operations/d1-pilot/readiness')return d1PilotReadiness(request,env);
  if(pathname==='/api/operations/d1-pilot/recent')return d1RecentGateway(request,env);
  if(pathname==='/api/operations/d1-pilot/ingest')return d1IngestGateway(request,env);
  return Promise.resolve(Response.json({ok:false,reason:'NOT_FOUND'}, {status:404}));
 }
};
