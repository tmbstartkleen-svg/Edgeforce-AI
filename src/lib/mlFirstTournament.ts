import {db} from './db';
import {RELEASE} from './releaseManifest';
import {activateMlService} from './mlActivation';
import {externalMlTournamentStatus} from './externalMlTournament';

type Candidate={
 tournamentRunId?:number; sport:string; marketKey:string; algorithm:string; serviceModelId:string;
 role:string; sampleSize:number; holdoutSize:number; holdoutBrier:number; holdoutLogLoss?:number;
 marketBaselineBrier:number; brierSkillScore:number; calibrationError:number; compositeScore:number;
 reason?:string; featureImportance?:Record<string,number>;
};
type Champion={
 sport:string; marketKey:string; algorithm:string; serviceModelId:string;
 compositeScore:number; brierSkillScore:number; holdoutBrier:number; holdoutLogLoss:number;
 calibrationError:number; promotedAt?:string; metadata?:Record<string,unknown>;
};

const key=(x:{sport:string;marketKey:string})=>`${x.sport}|${x.marketKey}`;
const pct=(a:number,b:number)=>b>0?(b-a)/b:0;

export function buildFirstTournamentLeaderboard(candidates:Candidate[]){
 const groups=new Map<string,Candidate[]>();
 for(const row of candidates){
  const k=key(row);
  groups.set(k,[...(groups.get(k)||[]),row]);
 }
 return [...groups.entries()].map(([group,rows])=>{
  const ranked=[...rows].sort((a,b)=>
   b.compositeScore-a.compositeScore||
   b.brierSkillScore-a.brierSkillScore||
   a.holdoutBrier-b.holdoutBrier
  );
  const winner=ranked[0]||null;
  const runnerUp=ranked[1]||null;
  return {
   group,
   sport:winner?.sport||group.split('|')[0],
   marketKey:winner?.marketKey||group.split('|').slice(1).join('|'),
   winner,
   runnerUp,
   margin:runnerUp&&winner?winner.compositeScore-runnerUp.compositeScore:null,
   marketBrierImprovement:winner?pct(winner.holdoutBrier,winner.marketBaselineBrier):0,
   eligibleCount:ranked.filter(x=>x.role==='CHAMPION'||x.role==='CHALLENGER'||x.role==='MONITORED').length,
   candidates:ranked.slice(0,5)
  };
 }).sort((a,b)=>
  (b.winner?.brierSkillScore||0)-(a.winner?.brierSkillScore||0)||
  (b.winner?.compositeScore||0)-(a.winner?.compositeScore||0)
 );
}

export function championChanges(before:Champion[],after:Champion[]){
 const previous=new Map(before.map(x=>[key(x),x]));
 return after.map(champion=>{
  const prior=previous.get(key(champion));
  const changed=!prior||prior.serviceModelId!==champion.serviceModelId;
  return {
   ...champion,
   action:!prior?'PROMOTED':changed?'REPLACED':'RETAINED',
   priorAlgorithm:prior?.algorithm||null,
   priorServiceModelId:prior?.serviceModelId||null,
   scoreDelta:prior?champion.compositeScore-prior.compositeScore:null
  };
 });
}

function serviceBase(){
 const explicit=String(process.env.ML_SERVICE_BASE_URL||'').trim().replace(/\/$/,'');
 if(explicit)return explicit;
 for(const raw of [process.env.ML_PREDICTION_SERVICE_URL,process.env.ML_TRAINING_SERVICE_URL]){
  const value=String(raw||'').trim();
  if(!value)continue;
  try{
   const url=new URL(value);
   url.pathname='';
   url.search='';
   url.hash='';
   return url.toString().replace(/\/$/,'');
  }catch{}
 }
 return '';
}

export async function verifyHostedChampionArtifacts(champions:Champion[]){
 const base=serviceBase();
 if(!base)return {ok:false,configured:false,verified:0,missing:champions.length,serviceVersion:null,rows:[],error:'ML service base URL unavailable'};
 const secret=String(process.env.ML_PREDICTION_SERVICE_KEY||process.env.ML_TRAINING_SERVICE_KEY||process.env.EXPERT_MODEL_SERVICE_KEY||'').trim();
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),Math.max(2000,Number(process.env.ML_CHAMPION_VERIFY_TIMEOUT_MS||10000)));
 try{
  const res=await fetch(base+'/champions',{
   headers:{accept:'application/json',...(secret?{authorization:`Bearer ${secret}`}:{})},
   cache:'no-store',signal:controller.signal
  });
  const body=await res.json().catch(()=>({})) as {
   ok?:boolean;serviceVersion?:string;schemaVersion?:string;
   champions?:Array<{serviceModelId?:string;algorithm?:string;sport?:string;marketKey?:string;artifactExists?:boolean;artifactBytes?:number}>
  };
  if(!res.ok||body.ok!==true||body.schemaVersion!=='edgeforce-ml-champions-v1')throw new Error(`champion artifact HTTP ${res.status}`);
  const byId=new Map((body.champions||[]).map(x=>[String(x.serviceModelId||''),x]));
  const rows=champions.map(champion=>{
   const hosted=byId.get(champion.serviceModelId);
   const artifactExists=Boolean(hosted?.artifactExists)&&Number(hosted?.artifactBytes||0)>0;
   return {
    sport:champion.sport,marketKey:champion.marketKey,algorithm:champion.algorithm,
    serviceModelId:champion.serviceModelId,artifactExists,
    artifactBytes:Number(hosted?.artifactBytes||0)
   };
  });
  const verified=rows.filter(x=>x.artifactExists).length;
  return {
   ok:verified===champions.length,configured:true,verified,missing:champions.length-verified,
   serviceVersion:body.serviceVersion||null,rows,
   error:verified===champions.length?null:'One or more promoted champions are missing persisted service artifacts'
  };
 }catch(error){
  return {ok:false,configured:true,verified:0,missing:champions.length,serviceVersion:null,rows:[],error:error instanceof Error?error.message:'champion artifact verification failed'};
 }finally{
  clearTimeout(timer);
 }
}

export function firstTournamentEvidence(input:{
 activationState:string; candidates:number; champions:number; sports:number; artifactsVerified:number; artifactsMissing:number;
}){
 if(!['ACTIVE','READY_AWAITING_EVIDENCE'].includes(input.activationState)){
  return {grade:'BLOCKED' as const,launchReady:false,reason:`Activation state ${input.activationState} is not launch-safe`};
 }
 if(input.candidates<1){
  return {grade:'NO_EVIDENCE' as const,launchReady:false,reason:'No heavyweight ML candidates were evaluated'};
 }
 if(input.champions<1){
  return {grade:'AWAITING_CHAMPION' as const,launchReady:false,reason:'Tournament completed but no candidate cleared promotion gates'};
 }
 if(input.artifactsMissing>0||input.artifactsVerified<input.champions){
  return {grade:'ARTIFACT_MISMATCH' as const,launchReady:false,reason:'A promoted database champion is missing from persistent hosted model storage'};
 }
 const minSports=Math.max(1,Number(process.env.ML_FIRST_TOURNAMENT_MIN_SPORTS||1));
 if(input.sports<minSports){
  return {grade:'LIMITED_COVERAGE' as const,launchReady:true,reason:`${input.sports} sport(s) have champions; minimum preferred coverage is ${minSports}`};
 }
 return {grade:'VERIFIED' as const,launchReady:true,reason:'Tournament produced persisted, hosted champions with auditable holdout evidence'};
}

export async function runFirstChampionTournament(){
 const sql=db();
 const before=await externalMlTournamentStatus();
 const startedAt=new Date();
 let runId:number|null=null;
 if(sql){
  const rows=await sql`
   insert into ml_first_tournament_runs(model_version,status,champions_before,started_at)
   values(${RELEASE.modelVersion},'running',${before.summary?.champions||0},now())
   returning id
  `;
  runId=Number(rows[0]?.id||0)||null;
 }

 try{
  const activation=await activateMlService({runTournament:true});
  const after=await externalMlTournamentStatus();
  const tournamentRunId=Number((activation.tournament as any)?.runId||after.latestRun?.id||0)||null;
  const candidates=(after.candidates as Candidate[]).filter(x=>!tournamentRunId||Number(x.tournamentRunId)===tournamentRunId);
  const leaderboard=buildFirstTournamentLeaderboard(candidates);
  const champions=after.champions as Champion[];
  const changes=championChanges(before.champions as Champion[],champions);
  const artifacts=await verifyHostedChampionArtifacts(champions);
  const sports=new Set(champions.map(x=>x.sport)).size;
  const evidence=firstTournamentEvidence({
   activationState:activation.readiness.state,
   candidates:candidates.length,
   champions:champions.length,
   sports,
   artifactsVerified:artifacts.verified,
   artifactsMissing:artifacts.missing
  });

  if(sql){
   for(const row of changes){
    await sql`
     insert into external_ml_champion_history(
      tournament_run_id,sport,market_key,algorithm,service_model_id,action,
      composite_score,brier_skill_score,holdout_brier,holdout_log_loss,calibration_error,
      reason,model_version,metadata,recorded_at
     ) values(
      ${tournamentRunId},${row.sport},${row.marketKey},${row.algorithm},${row.serviceModelId},${row.action},
      ${row.compositeScore},${row.brierSkillScore},${row.holdoutBrier},${row.holdoutLogLoss},${row.calibrationError},
      ${String((row.metadata as any)?.promotionReason||evidence.reason)},${RELEASE.modelVersion},
      ${sql.json({priorAlgorithm:row.priorAlgorithm,priorServiceModelId:row.priorServiceModelId,scoreDelta:row.scoreDelta} as any)},now()
     )
    `;
   }
   if(runId){
    await sql`
     update ml_first_tournament_runs set
      status=${evidence.launchReady?'completed':'held'},tournament_run_id=${tournamentRunId},
      activation_state=${activation.readiness.state},service_version=${artifacts.serviceVersion||activation.health.serviceVersion||null},
      candidates_evaluated=${candidates.length},champions_after=${champions.length},
      champion_changes=${changes.filter(x=>x.action!=='RETAINED').length},sports_covered=${sports},
      artifacts_verified=${artifacts.verified},artifacts_missing=${artifacts.missing},
      leaderboard=${sql.json(leaderboard as any)},coverage=${sql.json({evidence,sports,groups:leaderboard.length} as any)},
      artifact_verification=${sql.json(artifacts as any)},completed_at=now()
     where id=${runId}
    `;
   }
  }

  return {
   ok:true,build:'V60',schemaVersion:'v60-first-champion-tournament-1',
   runId,startedAt:startedAt.toISOString(),tournamentRunId,
   activation:activation.readiness,evidence,leaderboard,champions,changes,artifacts,
   summary:{
    candidates:candidates.length,groups:leaderboard.length,champions:champions.length,
    sports,championChanges:changes.filter(x=>x.action!=='RETAINED').length,
    artifactsVerified:artifacts.verified,artifactsMissing:artifacts.missing
   }
  };
 }catch(error){
  if(sql&&runId){
   await sql`
    update ml_first_tournament_runs set status='failed',completed_at=now(),
     error_text=${error instanceof Error?error.message:'first champion tournament failed'}
    where id=${runId}
   `.catch(()=>undefined);
  }
  throw error;
 }
}

export async function firstChampionTournamentStatus(){
 const sql=db();
 const tournament=await externalMlTournamentStatus();
 if(!sql)return {
  ok:true,build:'V60',schemaVersion:'v60-first-champion-tournament-1',
  latest:null,championHistory:[],tournament
 };
 try{
  const [latest]=await sql`
   select id,model_version as "modelVersion",status,tournament_run_id as "tournamentRunId",
    activation_state as "activationState",service_version as "serviceVersion",
    candidates_evaluated as "candidatesEvaluated",champions_before as "championsBefore",
    champions_after as "championsAfter",champion_changes as "championChanges",
    sports_covered as "sportsCovered",artifacts_verified as "artifactsVerified",
    artifacts_missing as "artifactsMissing",leaderboard,coverage,
    artifact_verification as "artifactVerification",error_text as error,
    started_at as "startedAt",completed_at as "completedAt"
   from ml_first_tournament_runs order by started_at desc limit 1
  `;
  const history=await sql`
   select tournament_run_id as "tournamentRunId",sport,market_key as "marketKey",
    algorithm,service_model_id as "serviceModelId",action,
    composite_score::float as "compositeScore",brier_skill_score::float as "brierSkillScore",
    holdout_brier::float as "holdoutBrier",holdout_log_loss::float as "holdoutLogLoss",
    calibration_error::float as "calibrationError",reason,model_version as "modelVersion",
    metadata,recorded_at as "recordedAt"
   from external_ml_champion_history order by recorded_at desc limit 500
  `;
  return {
   ok:true,build:'V60',schemaVersion:'v60-first-champion-tournament-1',
   latest:latest||null,championHistory:history,tournament
  };
 }catch(error){
  return {
   ok:false,build:'V60',schemaVersion:'v60-first-champion-tournament-1',
   latest:null,championHistory:[],tournament,
   error:error instanceof Error?error.message:'first champion tournament status failed'
  };
 }
}
