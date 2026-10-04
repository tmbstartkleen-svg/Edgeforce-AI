import {db} from './db';
import {RELEASE} from './releaseManifest';
import type {Market} from './types';
import type {PredictionFeedbackResult} from './predictionFeedback';
import {canonicalTrainingSport,trainingFeatureNames,trainingFeatureVectorFromMarket} from './trainedSportModels';
import {modelCouncil} from './modelCouncil';
import {mlServiceCircuitAllows,recordMlServiceFailure,recordMlServiceSuccess} from './mlServiceHealth';

export type ShadowCandidateInput={
 sport:string;
 marketKey:string;
 algorithm:string;
 serviceModelId:string;
 artifactUri?:string|null;
 candidateId?:number|null;
 tournamentRunId?:number|null;
 holdoutBrier:number;
 holdoutLogLoss:number;
 calibrationError:number;
 brierSkillScore:number;
 compositeScore:number;
};

type ShadowRow={
 id:number;sport:string;marketKey:string;algorithm:string;serviceModelId:string;
 artifactUri?:string|null;candidateId?:number|null;sourceTournamentRunId?:number|null;
 status:string;holdoutBrier:number;holdoutLogLoss:number;holdoutCalibrationError:number;
 holdoutBrierSkillScore:number;compositeScore:number;settledSampleSize:number;
 confirmations:number;startedAt:string;
};

type SettledShadowRow={
 probability:number;outcome:number;marketBaselineProbability:number;
 nativeProbability:number;settledAt:string;
};

type ShadowPrediction={
 marketId:string;probability:number;confidence?:number;model?:string;
 version?:string;serviceModelId?:string;shadow?:boolean;
};

const clamp=(n:number,min=.0001,max=.9999)=>Math.max(min,Math.min(max,n));
const mean=(xs:number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0;

function calibrationError(rows:SettledShadowRow[]){
 if(!rows.length)return 0;
 const buckets=new Map<number,{p:number[];y:number[]}>();
 for(const row of rows){
  const bucket=Math.min(9,Math.floor(clamp(row.probability,0,.999999)*10));
  const item=buckets.get(bucket)||{p:[],y:[]};
  item.p.push(row.probability);item.y.push(row.outcome);buckets.set(bucket,item);
 }
 let weighted=0;
 for(const item of buckets.values())weighted+=Math.abs(mean(item.p)-mean(item.y))*item.p.length;
 return weighted/rows.length;
}

export function shadowRecoveryMetrics(rows:SettledShadowRow[],holdoutBrier:number){
 const valid=rows.filter(row=>
  Number.isFinite(row.probability)&&row.probability>0&&row.probability<1&&
  (row.outcome===0||row.outcome===1)&&
  Number.isFinite(row.marketBaselineProbability)&&row.marketBaselineProbability>0&&row.marketBaselineProbability<1&&
  Number.isFinite(row.nativeProbability)&&row.nativeProbability>0&&row.nativeProbability<1
 );
 if(!valid.length)return {
  sampleSize:0,liveBrier:0,liveLogLoss:0,liveCalibrationError:0,
  marketBrier:0,nativeBrier:0,marketBrierSkillScore:0,nativeBrierSkillScore:0,brierDegradation:0
 };
 const liveBrier=mean(valid.map(row=>(row.probability-row.outcome)**2));
 const marketBrier=mean(valid.map(row=>(row.marketBaselineProbability-row.outcome)**2));
 const nativeBrier=mean(valid.map(row=>(row.nativeProbability-row.outcome)**2));
 const liveLogLoss=mean(valid.map(row=>-(row.outcome*Math.log(clamp(row.probability))+(1-row.outcome)*Math.log(clamp(1-row.probability)))));
 const liveCalibrationError=calibrationError(valid);
 const marketBrierSkillScore=marketBrier>0?1-liveBrier/marketBrier:0;
 const nativeBrierSkillScore=nativeBrier>0?1-liveBrier/nativeBrier:0;
 return {
  sampleSize:valid.length,liveBrier,liveLogLoss,liveCalibrationError,marketBrier,nativeBrier,
  marketBrierSkillScore,nativeBrierSkillScore,brierDegradation:liveBrier-holdoutBrier
 };
}

export function shadowRecoveryDecision(input:{
 sampleSize:number;marketBrierSkillScore:number;nativeBrierSkillScore:number;
 liveCalibrationError:number;brierDegradation:number;priorConfirmations?:number;
 cooldownActive?:boolean;minSample?:number;
}){
 const minSample=input.minSample??Math.max(25,Number(process.env.ML_SHADOW_RECOVERY_MIN_SAMPLE||50));
 if(input.sampleSize<minSample)return {
  state:'INSUFFICIENT' as const,action:'NONE' as const,
  reason:'Need '+minSample+' settled shadow predictions; have '+input.sampleSize
 };

 const reject=
  (input.marketBrierSkillScore<=Number(process.env.ML_SHADOW_REJECT_MARKET_SKILL||-.08)
   &&input.nativeBrierSkillScore<=Number(process.env.ML_SHADOW_REJECT_NATIVE_SKILL||-.05))
  ||input.liveCalibrationError>=Number(process.env.ML_SHADOW_REJECT_CALIBRATION||.18)
  ||input.brierDegradation>=Number(process.env.ML_SHADOW_REJECT_BRIER_DEGRADATION||.08);
 if(reject)return {
  state:'REJECTED' as const,action:'REJECT' as const,
  reason:'Shadow challenger failed live recovery guardrails'
 };

 const pass=
  input.marketBrierSkillScore>=Number(process.env.ML_SHADOW_MIN_MARKET_SKILL||.02)
  &&input.nativeBrierSkillScore>=Number(process.env.ML_SHADOW_MIN_NATIVE_SKILL||.02)
  &&input.liveCalibrationError<=Number(process.env.ML_SHADOW_MAX_CALIBRATION||.10)
  &&input.brierDegradation<=Number(process.env.ML_SHADOW_MAX_BRIER_DEGRADATION||.04);

 if(!pass)return {
  state:'SHADOW' as const,action:'NONE' as const,
  reason:'Live evidence is not yet strong enough to restore external ML'
 };
 if(input.cooldownActive)return {
  state:'COOLDOWN' as const,action:'NONE' as const,
  reason:'Live evidence currently passes, but the post-quarantine cooldown is still active'
 };
 if((input.priorConfirmations??0)>=1)return {
  state:'RECOVERY_READY' as const,action:'PROMOTE' as const,
  reason:'Live shadow challenger beat both market and native baselines on repeated fresh evidence'
 };
 return {
  state:'READY_CONFIRM' as const,action:'NONE' as const,
  reason:'Live recovery gates passed once; one additional confirmation with new settled evidence is required'
 };
}

function shadowUrl(){
 const explicit=String(process.env.ML_SHADOW_PREDICTION_SERVICE_URL||'').trim();
 if(explicit)return explicit;
 const prediction=String(process.env.ML_PREDICTION_SERVICE_URL||'').trim();
 if(!prediction)return '';
 try{
  const url=new URL(prediction);
  url.pathname='/shadow-predict';url.search='';url.hash='';
  return url.toString();
 }catch{return ''}
}

function promotionUrl(){
 const explicit=String(process.env.ML_PROMOTION_SERVICE_URL||'').trim();
 if(explicit)return explicit;
 const training=String(process.env.ML_TRAINING_SERVICE_URL||'').trim();
 if(!training)return '';
 try{
  const url=new URL(training);
  url.pathname='/promote';url.search='';url.hash='';
  return url.toString();
 }catch{return ''}
}

function serviceKey(){
 return String(process.env.ML_TRAINING_SERVICE_KEY||process.env.ML_PREDICTION_SERVICE_KEY||process.env.EXPERT_MODEL_SERVICE_KEY||'').trim();
}

function nativeProbability(market:Market){
 const features={...(market.sportFeatures||{})};
 delete features.externalExpertProbability;
 delete features.externalExpertConfidence;
 delete features.externalExpertModelCount;
 const nativeMarket={...market,sportFeatures:features};
 return clamp(modelCouncil(nativeMarket).ensemble,.001,.999);
}

async function quarantineState(sport:string,marketKey:string){
 const sql=db();
 const hours=Math.max(1,Number(process.env.ML_CHAMPION_QUARANTINE_COOLDOWN_HOURS||24));
 if(!sql)return {quarantined:false,cooldownActive:false,cooldownUntil:null as string|null,hours};
 const rows=await sql`
  select recorded_at as "recordedAt"
  from external_ml_champion_history
  where sport=${sport} and market_key=${marketKey} and action='QUARANTINED'
  order by recorded_at desc limit 1
 `.catch(()=>[]);
 if(!rows.length)return {quarantined:false,cooldownActive:false,cooldownUntil:null as string|null,hours};
 const at=new Date((rows[0] as any).recordedAt).getTime();
 const until=at+hours*3600000;
 return {quarantined:true,cooldownActive:Date.now()<until,cooldownUntil:new Date(until).toISOString(),hours};
}

export async function startShadowChallenger(input:ShadowCandidateInput){
 const sql=db();
 if(!sql)return {ok:true,mode:'dry-run' as const,started:false,retained:false,id:null};
 const existing=await sql`
  select id,sport,market_key as "marketKey",algorithm,service_model_id as "serviceModelId",status
  from external_ml_shadow_challengers
  where sport=${input.sport} and market_key=${input.marketKey}
   and status in ('SHADOW','READY_CONFIRM')
  order by started_at desc limit 1
 `;
 if(existing.length){
  return {ok:true,mode:'database' as const,started:false,retained:true,id:Number((existing[0] as any).id),challenger:existing[0]};
 }
 const inserted=await sql`
  insert into external_ml_shadow_challengers(
   sport,market_key,algorithm,service_model_id,artifact_uri,candidate_id,source_tournament_run_id,status,
   holdout_brier,holdout_log_loss,holdout_calibration_error,holdout_brier_skill_score,composite_score,
   model_version,metadata,started_at
  ) values(
   ${input.sport},${input.marketKey},${input.algorithm},${input.serviceModelId},${input.artifactUri??null},
   ${input.candidateId??null},${input.tournamentRunId??null},'SHADOW',
   ${input.holdoutBrier},${input.holdoutLogLoss},${input.calibrationError},${input.brierSkillScore},
   ${input.compositeScore},${RELEASE.modelVersion},
   ${sql.json({purpose:'post-quarantine-live-recovery',productionWeight:0} as any)},now()
  )
  returning id,sport,market_key as "marketKey",algorithm,service_model_id as "serviceModelId",status
 `;
 return {ok:true,mode:'database' as const,started:true,retained:false,id:Number((inserted[0] as any)?.id||0),challenger:inserted[0]||null};
}

async function activeShadowRows():Promise<ShadowRow[]>{
 const sql=db(); if(!sql)return [];
 const rows=await sql`
  select id,sport,market_key as "marketKey",algorithm,service_model_id as "serviceModelId",
   artifact_uri as "artifactUri",candidate_id as "candidateId",source_tournament_run_id as "sourceTournamentRunId",
   status,holdout_brier::float as "holdoutBrier",holdout_log_loss::float as "holdoutLogLoss",
   holdout_calibration_error::float as "holdoutCalibrationError",
   holdout_brier_skill_score::float as "holdoutBrierSkillScore",composite_score::float as "compositeScore",
   settled_sample_size as "settledSampleSize",confirmations,started_at as "startedAt"
  from external_ml_shadow_challengers
  where status in ('SHADOW','READY_CONFIRM')
  order by sport,market_key,started_at
 `;
 return rows as unknown as ShadowRow[];
}

export async function recordShadowChallengerPredictions(markets:Market[]){
 const sql=db();
 if(!sql||!markets.length)return {written:0,requested:0,challengers:0,mode:'dry-run' as const};
 const shadows=await activeShadowRows();
 if(!shadows.length)return {written:0,requested:0,challengers:0,mode:'database' as const};
 const url=shadowUrl();
 if(!url)return {written:0,requested:0,challengers:shadows.length,mode:'unconfigured' as const,error:'ML shadow prediction endpoint is not configured'};
 if(!mlServiceCircuitAllows())return {written:0,requested:0,challengers:shadows.length,mode:'circuit-open' as const,error:'ML service circuit is open'};

 const exact=new Map<string,ShadowRow>();
 const broad=new Map<string,ShadowRow>();
 for(const row of shadows){
  exact.set(row.sport+'|'+row.marketKey.toLowerCase(),row);
  if(row.marketKey==='*')broad.set(row.sport,row);
 }

 const requests:Array<{requestId:string;market:Market;shadow:ShadowRow;nativeProbability:number;featureNames:string[];features:number[]}>= [];
 for(const market of markets.slice(0,1000)){
  const sport=canonicalTrainingSport(market.sport||market.league);
  const shadow=exact.get(sport+'|'+market.market.toLowerCase())||broad.get(sport);
  if(!shadow)continue;
  const featureNames=trainingFeatureNames(sport);
  if(!featureNames.length)continue;
  const requestId=[shadow.id,market.id,market.market,market.selection].join('::');
  requests.push({
   requestId,market,shadow,nativeProbability:nativeProbability(market),featureNames,
   features:trainingFeatureVectorFromMarket(market,featureNames)
  });
 }
 if(!requests.length)return {written:0,requested:0,challengers:shadows.length,mode:'database' as const};

 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),Math.max(2500,Number(process.env.ML_SHADOW_PREDICTION_TIMEOUT_MS||12000)));
 try{
  const res=await fetch(url,{
   method:'POST',
   headers:{'content-type':'application/json',accept:'application/json',...(serviceKey()?{authorization:'Bearer '+serviceKey()}:{})},
   body:JSON.stringify({
    schemaVersion:'edgeforce-ml-shadow-predict-v1',
    markets:requests.map(row=>({
     id:row.requestId,sport:canonicalTrainingSport(row.market.sport||row.market.league),
     market:row.market.market,serviceModelId:row.shadow.serviceModelId,
     featureNames:row.featureNames,features:row.features
    }))
   }),
   cache:'no-store',signal:controller.signal
  });
  const body=await res.json().catch(()=>({})) as {ok?:boolean;serviceVersion?:string;predictions?:ShadowPrediction[];warnings?:string[];detail?:unknown};
  if(!res.ok||body.ok===false)throw new Error('shadow prediction HTTP '+res.status+': '+JSON.stringify(body.detail||body).slice(0,400));
  await recordMlServiceSuccess({serviceVersion:body.serviceVersion||null});
  const requestMap=new Map(requests.map(row=>[row.requestId,row]));
  let written=0;
  const touched=new Set<number>();
  for(const prediction of Array.isArray(body.predictions)?body.predictions:[]){
   const source=requestMap.get(String(prediction.marketId||''));
   if(!source)continue;
   const probability=Number(prediction.probability);
   if(!Number.isFinite(probability)||probability<=0||probability>=1)continue;
   const inserted=await sql`
    insert into external_ml_shadow_prediction_snapshots(
     challenger_id,market_id,selection_key,sport,market_key,algorithm,service_model_id,
     probability,confidence,market_baseline_probability,native_probability,observed_at,metadata
    ) values(
     ${source.shadow.id},${source.market.id},${source.market.selection},
     ${canonicalTrainingSport(source.market.sport||source.market.league)},${source.market.market},
     ${source.shadow.algorithm},${source.shadow.serviceModelId},${probability},
     ${Number.isFinite(Number(prediction.confidence))?Number(prediction.confidence):.60},
     ${clamp(source.market.marketProb,.001,.999)},${source.nativeProbability},now(),
     ${sql.json({event:source.market.event,odds:source.market.odds,modelVersion:RELEASE.modelVersion,shadowOnly:true,productionWeight:0} as any)}
    )
    on conflict (challenger_id,market_id,market_key,selection_key) do nothing
    returning id
   `;
   if(inserted.length){written++;touched.add(source.shadow.id)}
  }
  for(const id of touched){
   await sql`update external_ml_shadow_challengers set last_prediction_at=now() where id=${id}`;
  }
  return {written,requested:requests.length,challengers:shadows.length,mode:'database' as const,warnings:body.warnings||[]};
 }catch(error){
  await recordMlServiceFailure(error);
  return {written:0,requested:requests.length,challengers:shadows.length,mode:'failed' as const,error:error instanceof Error?error.message:'shadow prediction failed'};
 }finally{clearTimeout(timer)}
}

export async function settleShadowPredictionFeedback(results:PredictionFeedbackResult[]){
 const sql=db();
 if(!sql)return {matched:0,settled:0,mode:'dry-run' as const};
 let matched=0,settled=0;
 for(const result of results){
  if(result.result==='push')continue;
  const outcome=result.result==='win'?1:0;
  const rows=await sql`
   update external_ml_shadow_prediction_snapshots
   set outcome=${outcome},closing_odds=${result.closingOdds??null},
       settled_at=${result.settledAt||new Date().toISOString()}
   where market_id=${result.eventId} and outcome is null
    and (${result.marketKey??null}::text is null or lower(market_key)=lower(${result.marketKey??''}))
    and lower(selection_key)=lower(${result.selectionKey})
   returning id
  `;
  matched+=rows.length;settled+=rows.length;
 }
 return {matched,settled,mode:'database' as const};
}

async function settledRows(challengerId:number,limit:number):Promise<SettledShadowRow[]>{
 const sql=db(); if(!sql)return [];
 const rows=await sql`
  select probability::float,outcome,
   market_baseline_probability::float as "marketBaselineProbability",
   native_probability::float as "nativeProbability",settled_at as "settledAt"
  from external_ml_shadow_prediction_snapshots
  where challenger_id=${challengerId} and outcome is not null
  order by settled_at desc
  limit ${Math.max(1,Math.min(1000,limit))}
 `;
 return rows as unknown as SettledShadowRow[];
}

async function priorConfirmations(challengerId:number,currentSampleSize:number){
 const sql=db(); if(!sql)return 0;
 const rows=await sql`
  select state,sample_size as "sampleSize"
  from ml_shadow_recovery_snapshots
  where challenger_id=${challengerId}
  order by observed_at desc limit 3
 `;
 let confirmations=0;
 let ceiling=currentSampleSize;
 for(const row of rows as any[]){
  const sample=Number(row.sampleSize||0);
  if(String(row.state)!=='READY_CONFIRM'||sample>=ceiling)break;
  confirmations++;
  ceiling=sample;
 }
 return confirmations;
}

async function activeChampionExists(sport:string,marketKey:string){
 const sql=db(); if(!sql)return false;
 const rows=await sql`
  select 1 from external_ml_champions
  where sport=${sport} and market_key=${marketKey} and active=true and status='ACTIVE'
  limit 1
 `;
 return rows.length>0;
}

async function promoteShadow(challenger:ShadowRow,reason:string){
 const url=promotionUrl();
 if(!url)return {ok:false,error:'ML promotion endpoint is not configured'};
 if(await activeChampionExists(challenger.sport,challenger.marketKey))return {ok:false,error:'An active external champion already occupies this slot'};
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),Math.max(3000,Number(process.env.ML_PROMOTION_TIMEOUT_MS||30000)));
 try{
  const res=await fetch(url,{
   method:'POST',
   headers:{'content-type':'application/json',accept:'application/json',...(serviceKey()?{authorization:'Bearer '+serviceKey()}:{})},
   body:JSON.stringify({
    schemaVersion:'edgeforce-ml-promote-v1',sport:challenger.sport,marketKey:challenger.marketKey,
    serviceModelId:challenger.serviceModelId,algorithm:challenger.algorithm,
    artifactUri:challenger.artifactUri||'',compositeScore:challenger.compositeScore,
    brierSkillScore:challenger.holdoutBrierSkillScore
   }),
   cache:'no-store',signal:controller.signal
  });
  const body=await res.json().catch(()=>({})) as {ok?:boolean;detail?:string};
  if(!res.ok||body.ok!==true)throw new Error(body.detail||('ML promotion HTTP '+res.status));
  return {ok:true,body};
 }catch(error){
  return {ok:false,error:error instanceof Error?error.message:'shadow promotion failed'};
 }finally{clearTimeout(timer)}
}

export async function runShadowRecovery(){
 const sql=db();
 if(!sql)return {ok:true,mode:'dry-run' as const,challengers:0,insufficient:0,shadow:0,readyConfirm:0,recovered:0,rejected:0,promotionFailed:0,rows:[]};
 const [run]=await sql`
  insert into ml_shadow_recovery_runs(model_version,status,started_at)
  values(${RELEASE.modelVersion},'running',now())
  returning id
 `;
 const window=Math.max(25,Number(process.env.ML_SHADOW_RECOVERY_WINDOW||150));
 const minSample=Math.max(25,Number(process.env.ML_SHADOW_RECOVERY_MIN_SAMPLE||50));
 let insufficient=0,shadow=0,readyConfirm=0,recovered=0,rejected=0,promotionFailed=0;
 const output:any[]=[];
 try{
  for(const challenger of await activeShadowRows()){
   const metrics=shadowRecoveryMetrics(await settledRows(challenger.id,window),challenger.holdoutBrier);
   const confirmations=await priorConfirmations(challenger.id,metrics.sampleSize);
   const quarantine=await quarantineState(challenger.sport,challenger.marketKey);
   const decision=shadowRecoveryDecision({...metrics,priorConfirmations:confirmations,cooldownActive:quarantine.cooldownActive,minSample});
   let state:string=decision.state;
   let action:string=decision.action;
   let reason=decision.reason;

   if(state==='INSUFFICIENT')insufficient++;
   else if(state==='READY_CONFIRM')readyConfirm++;
   else if(state==='REJECTED')rejected++;
   else shadow++;

   if(action==='REJECT'){
    await sql`
     update external_ml_shadow_challengers set status='REJECTED',recovery_eligible=false,
      decision_reason=${reason},last_evaluated_at=now(),completed_at=now(),
      settled_sample_size=${metrics.sampleSize},live_brier=${metrics.liveBrier},
      live_log_loss=${metrics.liveLogLoss},live_calibration_error=${metrics.liveCalibrationError},
      market_brier=${metrics.marketBrier},native_brier=${metrics.nativeBrier},
      market_brier_skill_score=${metrics.marketBrierSkillScore},native_brier_skill_score=${metrics.nativeBrierSkillScore},
      brier_degradation=${metrics.brierDegradation},confirmations=${confirmations}
     where id=${challenger.id}
    `;
   }else if(action==='PROMOTE'){
    const promoted=await promoteShadow(challenger,reason);
    if(promoted.ok){
     await sql`
      insert into external_ml_champions(
       sport,market_key,algorithm,service_model_id,candidate_id,artifact_uri,
       composite_score,brier_skill_score,holdout_brier,holdout_log_loss,calibration_error,
       promoted_at,model_version,metadata,active,status,quarantined_at,quarantine_reason,
       last_monitor_at,live_sample_size,live_brier,live_log_loss,live_calibration_error,
       live_brier_skill_score,live_drift_score
      ) values(
       ${challenger.sport},${challenger.marketKey},${challenger.algorithm},${challenger.serviceModelId},
       ${challenger.candidateId??null},${challenger.artifactUri??null},${challenger.compositeScore},
       ${challenger.holdoutBrierSkillScore},${challenger.holdoutBrier},${challenger.holdoutLogLoss},
       ${challenger.holdoutCalibrationError},now(),${RELEASE.modelVersion},
       ${sql.json({promotionReason:reason,recovery:'V60_SHADOW_LIVE_RECOVERY',shadowSampleSize:metrics.sampleSize,nativeBrierSkillScore:metrics.nativeBrierSkillScore,marketBrierSkillScore:metrics.marketBrierSkillScore} as any)},
       true,'ACTIVE',null,null,now(),${metrics.sampleSize},${metrics.liveBrier},${metrics.liveLogLoss},
       ${metrics.liveCalibrationError},${metrics.marketBrierSkillScore},0
      )
      on conflict (sport,market_key) do update set
       algorithm=excluded.algorithm,service_model_id=excluded.service_model_id,candidate_id=excluded.candidate_id,
       artifact_uri=excluded.artifact_uri,composite_score=excluded.composite_score,
       brier_skill_score=excluded.brier_skill_score,holdout_brier=excluded.holdout_brier,
       holdout_log_loss=excluded.holdout_log_loss,calibration_error=excluded.calibration_error,
       promoted_at=excluded.promoted_at,model_version=excluded.model_version,metadata=excluded.metadata,
       active=true,status='ACTIVE',quarantined_at=null,quarantine_reason=null,last_monitor_at=excluded.last_monitor_at,
       live_sample_size=excluded.live_sample_size,live_brier=excluded.live_brier,live_log_loss=excluded.live_log_loss,
       live_calibration_error=excluded.live_calibration_error,live_brier_skill_score=excluded.live_brier_skill_score,
       live_drift_score=excluded.live_drift_score
     `;
     await sql`
      update external_ml_shadow_challengers set status='RECOVERED',recovery_eligible=true,
       decision_reason=${reason},last_evaluated_at=now(),completed_at=now(),
       settled_sample_size=${metrics.sampleSize},live_brier=${metrics.liveBrier},
       live_log_loss=${metrics.liveLogLoss},live_calibration_error=${metrics.liveCalibrationError},
       market_brier=${metrics.marketBrier},native_brier=${metrics.nativeBrier},
       market_brier_skill_score=${metrics.marketBrierSkillScore},native_brier_skill_score=${metrics.nativeBrierSkillScore},
       brier_degradation=${metrics.brierDegradation},confirmations=${confirmations+1}
      where id=${challenger.id}
     `;
     await sql`
      insert into external_ml_champion_history(
       tournament_run_id,sport,market_key,algorithm,service_model_id,action,composite_score,brier_skill_score,
       holdout_brier,holdout_log_loss,calibration_error,reason,model_version,metadata,recorded_at
      ) values(
       ${challenger.sourceTournamentRunId??null},${challenger.sport},${challenger.marketKey},
       ${challenger.algorithm},${challenger.serviceModelId},'RECOVERED',${challenger.compositeScore},
       ${challenger.holdoutBrierSkillScore},${challenger.holdoutBrier},${challenger.holdoutLogLoss},
       ${challenger.holdoutCalibrationError},${reason},${RELEASE.modelVersion},
       ${sql.json({shadowSampleSize:metrics.sampleSize,marketBrierSkillScore:metrics.marketBrierSkillScore,nativeBrierSkillScore:metrics.nativeBrierSkillScore,liveCalibrationError:metrics.liveCalibrationError} as any)},now()
      )
     `;
     recovered++;state='RECOVERED';action='PROMOTED';
    }else{
     promotionFailed++;state='READY_CONFIRM';action='PROMOTION_FAILED';
     reason+='; '+promoted.error;
    }
   }else{
    const status=state==='READY_CONFIRM'?'READY_CONFIRM':'SHADOW';
    await sql`
     update external_ml_shadow_challengers set status=${status},
      recovery_eligible=${state==='READY_CONFIRM'},decision_reason=${reason},last_evaluated_at=now(),
      settled_sample_size=${metrics.sampleSize},live_brier=${metrics.liveBrier},
      live_log_loss=${metrics.liveLogLoss},live_calibration_error=${metrics.liveCalibrationError},
      market_brier=${metrics.marketBrier},native_brier=${metrics.nativeBrier},
      market_brier_skill_score=${metrics.marketBrierSkillScore},native_brier_skill_score=${metrics.nativeBrierSkillScore},
      brier_degradation=${metrics.brierDegradation},confirmations=${confirmations+(state==='READY_CONFIRM'?1:0)}
     where id=${challenger.id}
    `;
   }

   await sql`
    insert into ml_shadow_recovery_snapshots(
     recovery_run_id,challenger_id,sport,market_key,algorithm,service_model_id,state,sample_size,
     live_brier,live_log_loss,live_calibration_error,market_brier,native_brier,
     market_brier_skill_score,native_brier_skill_score,brier_degradation,prior_confirmations,
     action,reason,metrics,observed_at
    ) values(
     ${run.id},${challenger.id},${challenger.sport},${challenger.marketKey},${challenger.algorithm},
     ${challenger.serviceModelId},${state},${metrics.sampleSize},${metrics.liveBrier},
     ${metrics.liveLogLoss},${metrics.liveCalibrationError},${metrics.marketBrier},${metrics.nativeBrier},
     ${metrics.marketBrierSkillScore},${metrics.nativeBrierSkillScore},${metrics.brierDegradation},
     ${confirmations},${action},${reason},
     ${sql.json({cooldownActive:quarantine.cooldownActive,cooldownUntil:quarantine.cooldownUntil,holdoutBrier:challenger.holdoutBrier} as any)},now()
    )
   `;
   output.push({challenger,...metrics,state,action,reason,confirmations,cooldown:quarantine});
  }

  await sql`
   update ml_shadow_recovery_runs set status='completed',completed_at=now(),
    challengers_checked=${output.length},insufficient=${insufficient},shadow=${shadow},
    ready_confirm=${readyConfirm},recovered=${recovered},rejected=${rejected},
    promotion_failed=${promotionFailed}
   where id=${run.id}
  `;
  return {ok:true,mode:'database' as const,runId:Number((run as any).id),challengers:output.length,insufficient,shadow,readyConfirm,recovered,rejected,promotionFailed,rows:output};
 }catch(error){
  await sql`
   update ml_shadow_recovery_runs set status='failed',completed_at=now(),
    error_text=${error instanceof Error?error.message:'shadow recovery failed'}
   where id=${run.id}
  `.catch(()=>undefined);
  throw error;
 }
}

export async function shadowRecoveryStatus(){
 const sql=db();
 if(!sql)return {ok:true,source:'none' as const,latestRun:null,challengers:[],recent:[]};
 try{
  const [latestRun]=await sql`
   select id,model_version as "modelVersion",status,challengers_checked as "challengersChecked",
    insufficient,shadow,ready_confirm as "readyConfirm",recovered,rejected,
    promotion_failed as "promotionFailed",error_text as error,
    started_at as "startedAt",completed_at as "completedAt"
   from ml_shadow_recovery_runs order by started_at desc limit 1
  `;
  const challengers=await sql`
   select id,sport,market_key as "marketKey",algorithm,service_model_id as "serviceModelId",status,
    holdout_brier::float as "holdoutBrier",holdout_brier_skill_score::float as "holdoutBrierSkillScore",
    settled_sample_size as "settledSampleSize",live_brier::float as "liveBrier",
    live_log_loss::float as "liveLogLoss",live_calibration_error::float as "liveCalibrationError",
    market_brier::float as "marketBrier",native_brier::float as "nativeBrier",
    market_brier_skill_score::float as "marketBrierSkillScore",
    native_brier_skill_score::float as "nativeBrierSkillScore",brier_degradation::float as "brierDegradation",
    confirmations,recovery_eligible as "recoveryEligible",decision_reason as "decisionReason",
    started_at as "startedAt",last_prediction_at as "lastPredictionAt",
    last_evaluated_at as "lastEvaluatedAt",completed_at as "completedAt"
   from external_ml_shadow_challengers
   order by case when status in ('SHADOW','READY_CONFIRM') then 0 else 1 end,started_at desc
   limit 250
  `;
  const recent=await sql`
   select challenger_id as "challengerId",sport,market_key as "marketKey",algorithm,
    service_model_id as "serviceModelId",state,sample_size as "sampleSize",
    live_brier::float as "liveBrier",live_log_loss::float as "liveLogLoss",
    live_calibration_error::float as "liveCalibrationError",market_brier::float as "marketBrier",
    native_brier::float as "nativeBrier",market_brier_skill_score::float as "marketBrierSkillScore",
    native_brier_skill_score::float as "nativeBrierSkillScore",brier_degradation::float as "brierDegradation",
    prior_confirmations as "priorConfirmations",action,reason,metrics,observed_at as "observedAt"
   from ml_shadow_recovery_snapshots
   order by observed_at desc limit 500
  `;
  return {ok:true,source:'database' as const,latestRun:latestRun||null,challengers,recent};
 }catch(error){
  return {ok:false,source:'database' as const,latestRun:null,challengers:[],recent:[],error:error instanceof Error?error.message:'shadow recovery status failed'};
 }
}
