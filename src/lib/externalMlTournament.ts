import {db} from './db';
import {RELEASE} from './releaseManifest';
import {
 canonicalTrainingSport,trainingFeatureNames,trainingFeatureVectorFromHistory,
 type TrainingHistoryRow
} from './trainedSportModels';

type ServiceCandidate={
 algorithm:string;
 serviceModelId:string;
 artifactUri?:string;
 sampleSize:number;
 trainSize:number;
 calibrationSize:number;
 holdoutSize:number;
 holdoutBrier:number;
 holdoutLogLoss:number;
 holdoutAccuracy:number;
 marketBaselineBrier:number;
 marketBaselineLogLoss:number;
 brierSkillScore:number;
 calibrationError:number;
 compositeScore:number;
 eligible:boolean;
 role?:string;
 featureImportance?:Record<string,number>;
 hyperparameters?:Record<string,unknown>;
 trainingSeconds?:number;
};

type ServiceGroup={
 sport:string;
 marketKey:string;
 featureNames:string[];
 candidates:ServiceCandidate[];
 champion?:ServiceCandidate|null;
 challenger?:ServiceCandidate|null;
 errors?:Array<{algorithm:string;error:string}>;
};

type ServiceTrainResponse={
 ok?:boolean;
 serviceVersion?:string;
 algorithmsAvailable?:Record<string,boolean>;
 groups?:ServiceGroup[];
};

const obj=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const clamp=(n:number,min=0,max=1)=>Math.max(min,Math.min(max,n));
const decimal=(odds:number)=>odds>0?1+odds/100:1+100/Math.max(1,Math.abs(odds));
const implied=(odds:number)=>clamp(1/decimal(odds),.001,.999);

function supportedAlgorithms(){
 const configured=String(process.env.ML_TOURNAMENT_ALGORITHMS||'')
  .split(',').map(x=>x.trim()).filter(Boolean);
 return configured.length?configured:[
  'logistic_l2','random_forest','hist_gradient_boosting',
  'xgboost','lightgbm','catboost','stacking','pymc_bayesian_logistic'
 ];
}

function groupHistory(rows:TrainingHistoryRow[],minSample:number,maxRows:number){
 const groups=new Map<string,TrainingHistoryRow[]>();
 for(const row of rows){
  const sport=canonicalTrainingSport(row.sport);
  const names=trainingFeatureNames(sport);
  if(!names.length)continue;
  for(const marketKey of ['*',row.marketKey]){
   const key=`${sport}|${marketKey}`;
   groups.set(key,[...(groups.get(key)||[]),row]);
  }
 }
 return [...groups.entries()].map(([key,list])=>{
  const [sport,...marketParts]=key.split('|');
  const marketKey=marketParts.join('|');
  const sorted=[...list].sort((a,b)=>new Date(a.occurredAt).getTime()-new Date(b.occurredAt).getTime());
  return {sport,marketKey,list:sorted.slice(Math.max(0,sorted.length-maxRows))};
 }).filter(g=>g.list.length>=(g.marketKey==='*'?minSample:Math.max(minSample,120)));
}

async function currentChampion(sport:string,marketKey:string){
 const sql=db();
 if(!sql)return null;
 try{
  const rows=await sql`
   select sport,market_key as "marketKey",algorithm,service_model_id as "serviceModelId",
    candidate_id as "candidateId",artifact_uri as "artifactUri",
    composite_score::float as "compositeScore",brier_skill_score::float as "brierSkillScore",
    holdout_brier::float as "holdoutBrier",holdout_log_loss::float as "holdoutLogLoss",
    calibration_error::float as "calibrationError",promoted_at as "promotedAt",
    model_version as "modelVersion",metadata
   from external_ml_champions
   where sport=${sport} and market_key=${marketKey}
   limit 1
  `;
  return rows[0] as any||null;
 }catch{
  return null;
 }
}

async function callTrainingService(groups:Array<{sport:string;marketKey:string;featureNames:string[];rows:Array<{occurredAt:string;features:number[];outcome:0|1;marketProbability:number}>}>){
 const url=String(process.env.ML_TRAINING_SERVICE_URL||'').trim();
 if(!url)return {configured:false,ok:false,error:'ML_TRAINING_SERVICE_URL is not configured'} as const;
 const key=String(process.env.ML_TRAINING_SERVICE_KEY||process.env.EXPERT_MODEL_SERVICE_KEY||'').trim();
 const controller=new AbortController();
 const timeoutMs=Math.max(15000,Number(process.env.ML_TRAINING_TIMEOUT_MS||900000));
 const timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{
  const res=await fetch(url,{
   method:'POST',
   headers:{
    'content-type':'application/json',accept:'application/json',
    ...(key?{authorization:`Bearer ${key}`}:{})
   },
   body:JSON.stringify({
    schemaVersion:'edgeforce-ml-train-v1',
    modelVersion:RELEASE.modelVersion,
    algorithms:supportedAlgorithms(),
    groups
   }),
   cache:'no-store',
   signal:controller.signal
  });
  const body=await res.json().catch(()=>({})) as ServiceTrainResponse&{detail?:unknown};
  if(!res.ok||body.ok===false)throw new Error(`training service HTTP ${res.status}: ${JSON.stringify(body.detail||body).slice(0,500)}`);
  return {configured:true,ok:true,body} as const;
 }catch(error){
  return {configured:true,ok:false,error:error instanceof Error?error.message:'training service failed'} as const;
 }finally{
  clearTimeout(timer);
 }
}

async function promoteServiceCandidate(group:ServiceGroup,candidate:ServiceCandidate){
 const base=String(process.env.ML_PROMOTION_SERVICE_URL||'').trim();
 const train=String(process.env.ML_TRAINING_SERVICE_URL||'').trim();
 const url=base||(train.endsWith('/train')?train.slice(0,-6)+'/promote':'');
 if(!url)return {ok:false,error:'ML promotion URL is not configured or derivable'};
 const key=String(process.env.ML_TRAINING_SERVICE_KEY||process.env.EXPERT_MODEL_SERVICE_KEY||'').trim();
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),Math.max(5000,Number(process.env.ML_PROMOTION_TIMEOUT_MS||30000)));
 try{
  const res=await fetch(url,{
   method:'POST',
   headers:{
    'content-type':'application/json',accept:'application/json',
    ...(key?{authorization:`Bearer ${key}`}:{})
   },
   body:JSON.stringify({
    schemaVersion:'edgeforce-ml-promote-v1',
    sport:group.sport,marketKey:group.marketKey,
    serviceModelId:candidate.serviceModelId,algorithm:candidate.algorithm,
    artifactUri:candidate.artifactUri||'',
    compositeScore:candidate.compositeScore,brierSkillScore:candidate.brierSkillScore
   }),
   cache:'no-store',signal:controller.signal
  });
  if(!res.ok)throw new Error(`promotion service HTTP ${res.status}`);
  const body=await res.json().catch(()=>({}));
  return {ok:true,body};
 }catch(error){
  return {ok:false,error:error instanceof Error?error.message:'promotion failed'};
 }finally{
  clearTimeout(timer);
 }
}

function promotionDecision(candidate:ServiceCandidate,incumbent:any,margin:number){
 if(!candidate.eligible)return {promote:false,reason:'Candidate failed service eligibility gates'};
 if(!incumbent)return {promote:true,reason:'No incumbent external ML champion'};
 const incumbentScore=Number(incumbent.compositeScore)||0;
 const required=incumbentScore+margin;
 if(candidate.compositeScore>=required){
  return {promote:true,reason:`Candidate composite ${candidate.compositeScore.toFixed(4)} cleared incumbent ${incumbentScore.toFixed(4)} + margin ${margin.toFixed(4)}`};
 }
 return {promote:false,reason:`Incumbent retained: candidate ${candidate.compositeScore.toFixed(4)} < required ${required.toFixed(4)}`};
}

export async function runExternalMlTournament(){
 const sql=db();
 if(!sql)return {ok:true,mode:'dry-run' as const,configured:Boolean(process.env.ML_TRAINING_SERVICE_URL),rows:0,groups:0,candidates:0,promoted:0};
 const url=String(process.env.ML_TRAINING_SERVICE_URL||'').trim();
 if(!url)return {ok:true,mode:'unconfigured' as const,configured:false,rows:0,groups:0,candidates:0,promoted:0};

 const lookback=Math.max(1000,Number(process.env.ML_TOURNAMENT_LOOKBACK_ROWS||30000));
 const minSample=Math.max(80,Number(process.env.ML_TOURNAMENT_MIN_SAMPLE||120));
 const maxRows=Math.max(minSample,Number(process.env.ML_TOURNAMENT_MAX_GROUP_ROWS||6000));
 const promotionMargin=Math.max(0,Number(process.env.ML_TOURNAMENT_PROMOTION_MARGIN||.01));

 const [run]=await sql`
  insert into external_ml_tournament_runs(model_version,status,started_at,algorithms)
  values(${RELEASE.modelVersion},'running',now(),${sql.json(supportedAlgorithms())})
  returning id
 `;

 try{
  const rows=await sql`
   select occurred_at as "occurredAt",sport,market_key as "marketKey",
    predicted_probability::float as predicted,offered_odds as odds,outcome,features
   from historical_predictions
   where outcome is not null and model_name='Model Council'
   order by occurred_at desc
   limit ${lookback}
  `;
  const history=(rows as any[]).map(r=>({
   occurredAt:new Date(r.occurredAt).toISOString(),
   sport:String(r.sport),marketKey:String(r.marketKey),predicted:Number(r.predicted),
   odds:Number(r.odds),outcome:Number(r.outcome) as 0|1,features:obj(r.features)
  })) as TrainingHistoryRow[];

  const groups=groupHistory(history,minSample,maxRows);
  const payload=groups.map(group=>{
   const featureNames=trainingFeatureNames(group.sport);
   return {
    sport:group.sport,marketKey:group.marketKey,featureNames,
    rows:group.list.map(row=>({
     occurredAt:row.occurredAt,
     features:trainingFeatureVectorFromHistory(row,featureNames),
     outcome:row.outcome,
     marketProbability:implied(row.odds)
    }))
   };
  });

  const service=await callTrainingService(payload);
  if(!service.ok)throw new Error(service.error);
  const responseGroups=Array.isArray(service.body.groups)?service.body.groups:[];
  let candidatesEvaluated=0,promoted=0,challengers=0;

  for(const group of responseGroups){
   const incumbent=await currentChampion(group.sport,group.marketKey);
   const winner=group.champion||null;
   const decision=winner?promotionDecision(winner,incumbent,promotionMargin):{promote:false,reason:'No eligible service winner'};
   let promotionResult:{ok:boolean;error?:string}|null=null;
   if(winner&&decision.promote){
    promotionResult=await promoteServiceCandidate(group,winner);
    if(!promotionResult.ok)decision.promote=false;
   }

   const candidateIds=new Map<string,number>();
   for(const candidate of group.candidates||[]){
    let role='HELD';
    if(winner&&candidate.serviceModelId===winner.serviceModelId)role=decision.promote?'CHAMPION':'CHALLENGER';
    else if(candidate.eligible)role='MONITORED';
    if(role==='CHALLENGER')challengers++;
    const reason=winner&&candidate.serviceModelId===winner.serviceModelId
     ?(promotionResult?.ok===false?`Promotion failed: ${promotionResult.error}`:decision.reason)
     :(candidate.eligible?'Eligible but not tournament winner':'Failed service eligibility gates');
    const inserted=await sql`
     insert into external_ml_candidates(
      tournament_run_id,sport,market_key,algorithm,service_model_id,role,status,
      sample_size,train_size,calibration_size,holdout_size,
      holdout_brier,holdout_log_loss,holdout_accuracy,
      market_baseline_brier,market_baseline_log_loss,brier_skill_score,
      calibration_error,composite_score,feature_names,feature_importance,
      hyperparameters,artifact_uri,training_metadata,reason,model_version,created_at
     ) values(
      ${run.id},${group.sport},${group.marketKey},${candidate.algorithm},${candidate.serviceModelId},
      ${role},'EVALUATED',${candidate.sampleSize},${candidate.trainSize},${candidate.calibrationSize},${candidate.holdoutSize},
      ${candidate.holdoutBrier},${candidate.holdoutLogLoss},${candidate.holdoutAccuracy},
      ${candidate.marketBaselineBrier},${candidate.marketBaselineLogLoss},${candidate.brierSkillScore},
      ${candidate.calibrationError},${candidate.compositeScore},${sql.json(group.featureNames||[])},
      ${sql.json(candidate.featureImportance||{})},${sql.json(candidate.hyperparameters||{})},
      ${candidate.artifactUri||null},${sql.json({trainingSeconds:candidate.trainingSeconds??null,eligible:candidate.eligible})},
      ${reason},${RELEASE.modelVersion},now()
     ) returning id
    `;
    candidateIds.set(candidate.serviceModelId,Number(inserted[0]?.id||0));
    candidatesEvaluated++;
   }

   if(winner&&decision.promote&&promotionResult?.ok){
    const candidateId=candidateIds.get(winner.serviceModelId)||null;
    await sql`
     insert into external_ml_champions(
      sport,market_key,algorithm,service_model_id,candidate_id,artifact_uri,
      composite_score,brier_skill_score,holdout_brier,holdout_log_loss,calibration_error,
      promoted_at,model_version,metadata
     ) values(
      ${group.sport},${group.marketKey},${winner.algorithm},${winner.serviceModelId},${candidateId},
      ${winner.artifactUri||null},${winner.compositeScore},${winner.brierSkillScore},${winner.holdoutBrier},
      ${winner.holdoutLogLoss},${winner.calibrationError},now(),${RELEASE.modelVersion},
      ${sql.json({promotionReason:decision.reason,serviceVersion:service.body.serviceVersion||null})}
     )
     on conflict (sport,market_key) do update set
      algorithm=excluded.algorithm,service_model_id=excluded.service_model_id,candidate_id=excluded.candidate_id,
      artifact_uri=excluded.artifact_uri,composite_score=excluded.composite_score,
      brier_skill_score=excluded.brier_skill_score,holdout_brier=excluded.holdout_brier,
      holdout_log_loss=excluded.holdout_log_loss,calibration_error=excluded.calibration_error,
      promoted_at=excluded.promoted_at,model_version=excluded.model_version,metadata=excluded.metadata
    `;
    promoted++;
   }
  }

  await sql`
   update external_ml_tournament_runs set completed_at=now(),status='completed',
    service_version=${service.body.serviceVersion||null},rows_exported=${history.length},
    groups_requested=${payload.length},candidates_evaluated=${candidatesEvaluated},
    champions_promoted=${promoted},challengers_retained=${challengers},
    metrics=${sql.json({
     algorithmsAvailable:service.body.algorithmsAvailable||{},
     promotionMargin,minSample,maxRows,
     serviceGroups:responseGroups.length
    })}
   where id=${run.id}
  `;

  return {
   ok:true,mode:'service' as const,configured:true,runId:Number(run.id),
   serviceVersion:service.body.serviceVersion||null,rows:history.length,groups:payload.length,
   candidates:candidatesEvaluated,promoted,challengers,
   algorithmsAvailable:service.body.algorithmsAvailable||{}
  };
 }catch(error){
  await sql`
   update external_ml_tournament_runs set completed_at=now(),status='failed',
    error_text=${error instanceof Error?error.message:'external ML tournament failed'}
   where id=${run.id}
  `.catch(()=>undefined);
  throw error;
 }
}

export async function externalMlTournamentStatus(){
 const sql=db();
 if(!sql)return {ok:true,source:'none' as const,latestRun:null,champions:[],candidates:[],summary:{champions:0,sports:0,candidates:0}};
 try{
  const [latestRun]=await sql`
   select id,model_version as "modelVersion",service_version as "serviceVersion",status,
    rows_exported as "rowsExported",groups_requested as "groupsRequested",
    candidates_evaluated as "candidatesEvaluated",champions_promoted as "championsPromoted",
    challengers_retained as "challengersRetained",algorithms,metrics,error_text as error,
    started_at as "startedAt",completed_at as "completedAt"
   from external_ml_tournament_runs order by started_at desc limit 1
  `;
  const champions=await sql`
   select sport,market_key as "marketKey",algorithm,service_model_id as "serviceModelId",
    composite_score::float as "compositeScore",brier_skill_score::float as "brierSkillScore",
    holdout_brier::float as "holdoutBrier",holdout_log_loss::float as "holdoutLogLoss",
    calibration_error::float as "calibrationError",promoted_at as "promotedAt",
    model_version as "modelVersion",metadata
   from external_ml_champions order by sport,market_key
  `;
  const candidates=await sql`
   select sport,market_key as "marketKey",algorithm,service_model_id as "serviceModelId",
    role,status,sample_size as "sampleSize",holdout_size as "holdoutSize",
    holdout_brier::float as "holdoutBrier",holdout_log_loss::float as "holdoutLogLoss",
    market_baseline_brier::float as "marketBaselineBrier",brier_skill_score::float as "brierSkillScore",
    calibration_error::float as "calibrationError",composite_score::float as "compositeScore",
    feature_importance as "featureImportance",reason,created_at as "createdAt"
   from external_ml_candidates
   order by created_at desc limit 500
  `;
  return {
   ok:true,source:'database' as const,latestRun:latestRun||null,champions,candidates,
   summary:{
    champions:champions.length,
    sports:new Set((champions as any[]).map(x=>x.sport)).size,
    candidates:candidates.length
   }
  };
 }catch(error){
  return {ok:false,source:'database' as const,latestRun:null,champions:[],candidates:[],summary:{champions:0,sports:0,candidates:0},error:error instanceof Error?error.message:'external ML tournament status failed'};
 }
}
