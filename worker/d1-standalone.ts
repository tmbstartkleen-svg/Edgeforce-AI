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
import {scoreIngestReceipt} from './d1-score-ingest-receipt';
import {scoreHistoryAudit} from './d1-score-history-audit';
import {scoreCoverageMatrix} from './d1-score-coverage-matrix';
import {scoreCollectorReadiness} from './d1-score-collector-readiness';
import {scorePollingPlan} from './d1-score-polling-plan';
import {scoreSports} from '../src/lib/intelligence-core/score-source-catalog.mjs';
import {d1ScoreCoverage} from './d1-score-coverage';
type Env={CRON_SECRET?:string;INGEST_SECRET?:string;INTELLIGENCE_D1_WRITE_ENABLED?:string;SPORTS_D1_WRITE_ENABLED?:string;SPORTS_SCORE_COLLECT_ENABLED?:string;STORAGE_STEWARD_SCHEDULE_ENABLED?:string;SOURCE_FRESHNESS_SCHEDULE_ENABLED?:string;SCHEDULED_SCORE_COLLECTION_ENABLED?:string;INTELLIGENCE_DB?:any};
export default {
 async scheduled(_event:unknown,env:Env,ctx:{waitUntil(promise:Promise<unknown>):void}){
  if(env.STORAGE_STEWARD_SCHEDULE_ENABLED==='true')ctx.waitUntil(inspectStorageSteward(env).then(result=>{
   console.log('EdgeForce storage steward summary',JSON.stringify({ok:result.ok,mode:result.mode}));
  }).catch(()=>console.error('EdgeForce storage steward health probe failed')));
  if(env.SOURCE_FRESHNESS_SCHEDULE_ENABLED==='true')ctx.waitUntil(assessSourceFreshness(env).then(result=>{
   console.log('EdgeForce source freshness summary',JSON.stringify({ok:result.ok,sourceCount:'sourceCount' in result?result.sourceCount:0,staleEnabled:'staleEnabled' in result?result.staleEnabled:0}));
  }).catch(()=>console.error('EdgeForce source freshness probe failed')));
  // Fail-closed pilot scheduler: disabled unless separately opted in; never runs on production config by default.
  if(env.SCHEDULED_SCORE_COLLECTION_ENABLED==='true'&&env.SPORTS_SCORE_COLLECT_ENABLED==='true'&&env.INTELLIGENCE_D1_WRITE_ENABLED==='true'&&env.SPORTS_D1_WRITE_ENABLED!=='true'&&typeof env.CRON_SECRET==='string'&&env.CRON_SECRET.length>=24&&env.INTELLIGENCE_DB){
   const slot=Math.floor(Date.now()/300000)%2;
   const cohort=scoreSports.filter((_sport,index)=>index%2===slot);
   ctx.waitUntil((async()=>{
    const db=env.INTELLIGENCE_DB;
    const runId=crypto.randomUUID();
    const scheduledAt=new Date().toISOString();
    const results=[];
    try{
     await db.prepare(`CREATE TABLE IF NOT EXISTS score_scheduler_receipts (
      run_id TEXT NOT NULL, cohort INTEGER NOT NULL, scheduled_at TEXT NOT NULL,
      sport TEXT NOT NULL, source_id TEXT NOT NULL, attempt_count INTEGER NOT NULL DEFAULT 0,
      final_status INTEGER, completed_at TEXT, persisted INTEGER NOT NULL DEFAULT 0,
      outcome TEXT NOT NULL, PRIMARY KEY(run_id,sport)
     )`).run();
     for(const sport of cohort){
      const source=scoreboardSource(sport.id);
      await db.prepare("INSERT OR REPLACE INTO score_scheduler_receipts (run_id,cohort,scheduled_at,sport,source_id,attempt_count,outcome) VALUES (?,?,?,?,?,0,'RUNNING')")
       .bind(runId,slot,scheduledAt,sport.id,source.sourceId).run();
     }
     for(const sport of cohort){
      let status=0,attempts=0,persisted=false;
      const source=scoreboardSource(sport.id);
      for(let retry=0;retry<3;retry++){
       attempts++;
       try{
        const response=await collectMultiSportScores(new Request('https://edgeforce-internal/api/operations/d1-pilot/collect-scores?sport='+encodeURIComponent(sport.id),{method:'POST',headers:{Authorization:'Bearer '+env.CRON_SECRET}}),env);
        status=response.status;
        const body=await response.clone().json().catch(()=>null) as {ok?:boolean;accepted?:number;duplicates?:number;attempted?:number}|null;
        persisted=response.status===200&&body?.ok===true&&(Number(body.accepted||0)+Number(body.duplicates||0)>0);
       }catch{status=0;}
       if(status===200||status===422||status===400||status===401||status===403)break;
       if(retry<2)await new Promise(resolve=>setTimeout(resolve,250*(2**retry)));
      }
      const outcome=persisted?'PERSISTED':status===422?'NO_QUALIFYING_EVENTS':status===200?'PERSISTENCE_UNCONFIRMED':'FAILED';
      await db.prepare("UPDATE score_scheduler_receipts SET attempt_count=?,final_status=?,completed_at=?,persisted=?,outcome=? WHERE run_id=? AND sport=?")
       .bind(attempts,status,new Date().toISOString(),persisted?1:0,outcome,runId,sport.id).run();
      results.push({sport:sport.id,status,attempts,persisted,outcome});
     }
     console.log('EdgeForce isolated scheduled score cohort',JSON.stringify({runId,slot,scheduledAt,requested:cohort.length,results}));
    }catch(error){
     console.error('EdgeForce scheduler receipt failure',JSON.stringify({runId,slot,scheduledAt,reason:error instanceof Error?error.message:'UNKNOWN'}));
    }
   })());
  } },
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
  if(pathname==='/api/operations/d1-pilot/score-polling-plan')return scorePollingPlan(request,env);
  if(pathname==='/api/operations/d1-pilot/score-collector-readiness')return scoreCollectorReadiness(request,env);
  if(pathname==='/api/operations/d1-pilot/score-coverage-matrix')return scoreCoverageMatrix(request,env);
  if(pathname==='/api/operations/d1-pilot/score-history-audit')return scoreHistoryAudit(request,env);
  if(pathname==='/api/operations/d1-pilot/score-ingest-receipt')return scoreIngestReceipt(request,env);
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
