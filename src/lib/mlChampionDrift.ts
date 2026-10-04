import {db} from './db';
import {RELEASE} from './releaseManifest';
import type {PredictionFeedbackResult} from './predictionFeedback';

type ChampionRow={
 sport:string;marketKey:string;algorithm:string;serviceModelId:string;
 holdoutBrier:number;holdoutLogLoss:number;calibrationError:number;brierSkillScore:number;
 active:boolean;status:string;
};

type SettledRow={
 probability:number;outcome:number;marketBaselineProbability:number;settledAt:string;
};

const clamp=(n:number,min=.0001,max=.9999)=>Math.max(min,Math.min(max,n));
const mean=(xs:number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0;

function calibrationError(rows:SettledRow[]){
 if(!rows.length)return 0;
 const buckets=new Map<number,{p:number[];y:number[]}>();
 for(const row of rows){
  const b=Math.min(9,Math.floor(clamp(row.probability,0,.999999)*10));
  const x=buckets.get(b)||{p:[],y:[]};
  x.p.push(row.probability);x.y.push(row.outcome);buckets.set(b,x);
 }
 let weighted=0;
 for(const x of buckets.values())weighted+=Math.abs(mean(x.p)-mean(x.y))*x.p.length;
 return weighted/rows.length;
}

export function championLiveMetrics(rows:SettledRow[],trainingHoldoutBrier:number){
 const valid=rows.filter(x=>
  Number.isFinite(x.probability)&&x.probability>0&&x.probability<1&&
  (x.outcome===0||x.outcome===1)&&
  Number.isFinite(x.marketBaselineProbability)&&x.marketBaselineProbability>0&&x.marketBaselineProbability<1
 );
 if(!valid.length)return {
  sampleSize:0,liveBrier:0,liveLogLoss:0,liveCalibrationError:0,
  marketBrier:0,liveBrierSkillScore:0,brierDegradation:0,driftScore:0
 };
 const liveBrier=mean(valid.map(x=>(x.probability-x.outcome)**2));
 const marketBrier=mean(valid.map(x=>(x.marketBaselineProbability-x.outcome)**2));
 const liveLogLoss=mean(valid.map(x=>-(x.outcome*Math.log(clamp(x.probability))+(1-x.outcome)*Math.log(clamp(1-x.probability)))));
 const liveCalibrationError=calibrationError(valid);
 const liveBrierSkillScore=marketBrier>0?1-liveBrier/marketBrier:0;
 const brierDegradation=liveBrier-trainingHoldoutBrier;
 const driftScore=Math.max(
  0,
  Math.max(0,-liveBrierSkillScore)/.08,
  Math.max(0,brierDegradation)/.06,
  Math.max(0,liveCalibrationError-.08)/.08
 );
 return {sampleSize:valid.length,liveBrier,liveLogLoss,liveCalibrationError,marketBrier,liveBrierSkillScore,brierDegradation,driftScore};
}

export function championDriftDecision(input:{
 sampleSize:number;liveBrierSkillScore:number;brierDegradation:number;liveCalibrationError:number;
 previousCriticalRuns?:number;minSample?:number;
}){
 const minSample=input.minSample??Math.max(20,Number(process.env.ML_CHAMPION_DRIFT_MIN_SAMPLE||30));
 if(input.sampleSize<minSample)return {
  state:'INSUFFICIENT' as const,action:'NONE' as const,
  reason:'Need '+minSample+' settled live predictions; have '+input.sampleSize
 };
 const critical=
  input.liveBrierSkillScore<=Number(process.env.ML_CHAMPION_CRITICAL_SKILL||-.08)||
  input.brierDegradation>=Number(process.env.ML_CHAMPION_CRITICAL_BRIER_DELTA||.06)||
  input.liveCalibrationError>=Number(process.env.ML_CHAMPION_CRITICAL_CALIBRATION||.16);
 if(critical){
  const previousCritical=input.previousCriticalRuns??0;
  if(previousCritical>=1)return {
   state:'CRITICAL' as const,action:'QUARANTINE' as const,
   reason:'Critical drift repeated: skill '+input.liveBrierSkillScore.toFixed(3)+', Brier delta '+input.brierDegradation.toFixed(3)+', calibration '+input.liveCalibrationError.toFixed(3)
  };
  return {state:'CRITICAL' as const,action:'NONE' as const,reason:'Critical drift detected; one confirmation run required before quarantine'};
 }
 const watch=
  input.liveBrierSkillScore<Number(process.env.ML_CHAMPION_WATCH_SKILL||0)||
  input.brierDegradation>=Number(process.env.ML_CHAMPION_WATCH_BRIER_DELTA||.03)||
  input.liveCalibrationError>=Number(process.env.ML_CHAMPION_WATCH_CALIBRATION||.11);
 if(watch)return {
  state:'WATCH' as const,action:'NONE' as const,
  reason:'Performance weakening: skill '+input.liveBrierSkillScore.toFixed(3)+', Brier delta '+input.brierDegradation.toFixed(3)+', calibration '+input.liveCalibrationError.toFixed(3)
 };
 return {state:'HEALTHY' as const,action:'NONE' as const,reason:'Live champion remains within market-relative drift guardrails'};
}

function retirementUrl(){
 const explicit=String(process.env.ML_RETIRE_SERVICE_URL||'').trim();
 if(explicit)return explicit;
 for(const raw of [process.env.ML_PROMOTION_SERVICE_URL,process.env.ML_TRAINING_SERVICE_URL,process.env.ML_PREDICTION_SERVICE_URL]){
  const value=String(raw||'').trim();
  if(!value)continue;
  try{
   const url=new URL(value);
   url.pathname='/retire';url.search='';url.hash='';
   return url.toString();
  }catch{}
 }
 return '';
}

async function retireHostedChampion(champion:ChampionRow,reason:string){
 const url=retirementUrl();
 if(!url)return {ok:false,error:'ML retirement endpoint is not configured'};
 const secret=String(process.env.ML_TRAINING_SERVICE_KEY||process.env.ML_PREDICTION_SERVICE_KEY||process.env.EXPERT_MODEL_SERVICE_KEY||'').trim();
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),Math.max(2000,Number(process.env.ML_RETIRE_TIMEOUT_MS||10000)));
 try{
  const res=await fetch(url,{
   method:'POST',
   headers:{'content-type':'application/json',accept:'application/json',...(secret?{authorization:'Bearer '+secret}:{})},
   body:JSON.stringify({schemaVersion:'edgeforce-ml-retire-v1',sport:champion.sport,marketKey:champion.marketKey,serviceModelId:champion.serviceModelId,reason}),
   cache:'no-store',signal:controller.signal
  });
  const body=await res.json().catch(()=>({})) as {ok?:boolean;retired?:boolean;reason?:string;detail?:string};
  if(!res.ok||body.ok!==true)throw new Error(body.detail||('ML retire HTTP '+res.status));
  return {ok:true,retired:Boolean(body.retired),body};
 }catch(error){
  return {ok:false,error:error instanceof Error?error.message:'ML retirement failed'};
 }finally{clearTimeout(timer)}
}

export async function settleExternalMlPredictionFeedback(results:PredictionFeedbackResult[]){
 const sql=db();
 if(!sql)return {matched:0,settled:0,mode:'dry-run' as const};
 let matched=0,settled=0;
 for(const result of results){
  if(result.result==='push')continue;
  const outcome=result.result==='win'?1:0;
  const rows=await sql`
   update external_ml_prediction_snapshots
   set outcome=${outcome},settled_at=${result.settledAt||new Date().toISOString()},
       closing_odds=${result.closingOdds??null}
   where market_id=${result.eventId}
     and outcome is null
     and (${result.marketKey??null}::text is null or lower(market_key)=lower(${result.marketKey??''}))
     and lower(coalesce(metadata->>'selection',''))=lower(${result.selectionKey})
   returning id
  `;
  matched+=rows.length;settled+=rows.length;
 }
 return {matched,settled,mode:'database' as const};
}

async function championRows():Promise<ChampionRow[]>{
 const sql=db(); if(!sql)return [];
 const rows=await sql`
  select sport,market_key as "marketKey",algorithm,service_model_id as "serviceModelId",
   holdout_brier::float as "holdoutBrier",holdout_log_loss::float as "holdoutLogLoss",
   calibration_error::float as "calibrationError",brier_skill_score::float as "brierSkillScore",
   active,status
  from external_ml_champions
  where active=true and status='ACTIVE'
  order by sport,market_key
 `;
 return rows as unknown as ChampionRow[];
}

async function recentSettled(serviceModelId:string,limit:number):Promise<SettledRow[]>{
 const sql=db(); if(!sql)return [];
 const rows=await sql`
  select probability::float,outcome,
   coalesce(market_baseline_probability,(metadata->>'marketProbability')::float)::float as "marketBaselineProbability",
   settled_at as "settledAt"
  from external_ml_prediction_snapshots
  where service_model_id=${serviceModelId} and outcome is not null
   and coalesce(market_baseline_probability,(metadata->>'marketProbability')::float) is not null
  order by settled_at desc
  limit ${Math.max(1,Math.min(1000,limit))}
 `;
 return rows as unknown as SettledRow[];
}

async function previousCriticalRuns(serviceModelId:string,currentSampleSize:number){
 const sql=db(); if(!sql)return 0;
 const rows=await sql`
  select state,sample_size as "sampleSize" from ml_champion_monitor_snapshots
  where service_model_id=${serviceModelId}
  order by observed_at desc limit 2
 `;
 let consecutive=0;
 let ceiling=currentSampleSize;
 for(const row of rows as any[]){
  const sampleSize=Number(row.sampleSize||0);
  if(String(row.state)!=='CRITICAL'||sampleSize>=ceiling)break;
  consecutive++;
  ceiling=sampleSize;
 }
 return consecutive;
}

export async function runChampionDriftMonitor(){
 const sql=db();
 if(!sql)return {ok:true,mode:'dry-run' as const,champions:0,healthy:0,watch:0,critical:0,quarantined:0,insufficient:0,rows:[]};
 const [run]=await sql`
  insert into ml_champion_monitor_runs(model_version,status,started_at)
  values(${RELEASE.modelVersion},'running',now())
  returning id
 `;
 const window=Math.max(20,Number(process.env.ML_CHAMPION_DRIFT_WINDOW||100));
 const minSample=Math.max(20,Number(process.env.ML_CHAMPION_DRIFT_MIN_SAMPLE||30));
 const rows:any[]=[];
 let healthy=0,watch=0,critical=0,quarantined=0,insufficient=0;

 try{
  for(const champion of await championRows()){
   const settled=await recentSettled(champion.serviceModelId,window);
   const metrics=championLiveMetrics(settled,champion.holdoutBrier);
   const priorCritical=await previousCriticalRuns(champion.serviceModelId,metrics.sampleSize);
   const decision=championDriftDecision({...metrics,previousCriticalRuns:priorCritical,minSample});
   let action:string=decision.action;
   const state=decision.state;
   let reason=decision.reason;

   if(state==='HEALTHY')healthy++;
   else if(state==='WATCH')watch++;
   else if(state==='INSUFFICIENT')insufficient++;
   else critical++;

   if(action==='QUARANTINE'){
    const retired=await retireHostedChampion(champion,reason);
    if(retired.ok){
     await sql`
      update external_ml_champions set
       active=false,status='QUARANTINED',quarantined_at=now(),quarantine_reason=${reason},
       last_monitor_at=now(),live_sample_size=${metrics.sampleSize},
       live_brier=${metrics.liveBrier},live_log_loss=${metrics.liveLogLoss},
       live_calibration_error=${metrics.liveCalibrationError},
       live_brier_skill_score=${metrics.liveBrierSkillScore},live_drift_score=${metrics.driftScore}
      where sport=${champion.sport} and market_key=${champion.marketKey}
       and service_model_id=${champion.serviceModelId} and active=true
     `;
     await sql`
      insert into external_ml_champion_history(
       sport,market_key,algorithm,service_model_id,action,composite_score,brier_skill_score,
       holdout_brier,holdout_log_loss,calibration_error,reason,model_version,metadata,recorded_at
      ) select sport,market_key,algorithm,service_model_id,'QUARANTINED',composite_score,brier_skill_score,
       holdout_brier,holdout_log_loss,calibration_error,${reason},${RELEASE.modelVersion},
       ${sql.json({liveSampleSize:metrics.sampleSize,liveBrier:metrics.liveBrier,liveBrierSkillScore:metrics.liveBrierSkillScore,liveCalibrationError:metrics.liveCalibrationError,driftScore:metrics.driftScore} as any)},now()
      from external_ml_champions
      where sport=${champion.sport} and market_key=${champion.marketKey}
       and service_model_id=${champion.serviceModelId}
     `;
     quarantined++;action='QUARANTINED';
     reason+='; hosted champion retired and EdgeForce reverted to native-model fallback';
    }else{
     action='RETIRE_FAILED';
     reason+='; quarantine blocked because hosted retirement failed: '+retired.error;
    }
   }else{
    await sql`
     update external_ml_champions set
      last_monitor_at=now(),live_sample_size=${metrics.sampleSize},
      live_brier=${metrics.liveBrier},live_log_loss=${metrics.liveLogLoss},
      live_calibration_error=${metrics.liveCalibrationError},
      live_brier_skill_score=${metrics.liveBrierSkillScore},live_drift_score=${metrics.driftScore}
     where sport=${champion.sport} and market_key=${champion.marketKey}
      and service_model_id=${champion.serviceModelId}
    `;
   }

   await sql`
    insert into ml_champion_monitor_snapshots(
     monitor_run_id,sport,market_key,algorithm,service_model_id,state,sample_size,recent_window,
     live_brier,live_log_loss,live_calibration_error,live_brier_skill_score,market_brier,
     training_holdout_brier,brier_degradation,drift_score,prior_critical_runs,action,reason,metrics,
     model_version,observed_at
    ) values(
     ${run.id},${champion.sport},${champion.marketKey},${champion.algorithm},${champion.serviceModelId},
     ${state},${metrics.sampleSize},${window},${metrics.liveBrier},${metrics.liveLogLoss},
     ${metrics.liveCalibrationError},${metrics.liveBrierSkillScore},${metrics.marketBrier},
     ${champion.holdoutBrier},${metrics.brierDegradation},${metrics.driftScore},${priorCritical},
     ${action},${reason},${sql.json({trainingHoldoutLogLoss:champion.holdoutLogLoss,trainingCalibrationError:champion.calibrationError,trainingBrierSkillScore:champion.brierSkillScore} as any)},
     ${RELEASE.modelVersion},now()
    )
   `;
   rows.push({champion,...metrics,state,action,reason,priorCritical});
  }

  await sql`
   update ml_champion_monitor_runs set
    status='completed',completed_at=now(),champions_checked=${rows.length},
    healthy=${healthy},watch=${watch},critical=${critical},quarantined=${quarantined},insufficient=${insufficient}
   where id=${run.id}
  `;
  return {ok:true,mode:'database' as const,runId:Number(run.id),champions:rows.length,healthy,watch,critical,quarantined,insufficient,rows};
 }catch(error){
  await sql`
   update ml_champion_monitor_runs set status='failed',completed_at=now(),
    error_text=${error instanceof Error?error.message:'champion drift monitor failed'}
   where id=${run.id}
  `.catch(()=>undefined);
  throw error;
 }
}

export async function championDriftStatus(){
 const sql=db();
 if(!sql)return {ok:true,source:'none' as const,latestRun:null,champions:[],recent:[]};
 try{
  const [latestRun]=await sql`
   select id,model_version as "modelVersion",status,champions_checked as "championsChecked",
    healthy,watch,critical,quarantined,insufficient,error_text as error,
    started_at as "startedAt",completed_at as "completedAt"
   from ml_champion_monitor_runs order by started_at desc limit 1
  `;
  const champions=await sql`
   select sport,market_key as "marketKey",algorithm,service_model_id as "serviceModelId",
    active,status,promoted_at as "promotedAt",quarantined_at as "quarantinedAt",
    quarantine_reason as "quarantineReason",last_monitor_at as "lastMonitorAt",
    live_sample_size as "liveSampleSize",live_brier::float as "liveBrier",
    live_log_loss::float as "liveLogLoss",live_calibration_error::float as "liveCalibrationError",
    live_brier_skill_score::float as "liveBrierSkillScore",live_drift_score::float as "liveDriftScore",
    holdout_brier::float as "holdoutBrier",brier_skill_score::float as "trainingBrierSkillScore"
   from external_ml_champions order by active desc,sport,market_key
  `;
  const recent=await sql`
   select sport,market_key as "marketKey",algorithm,service_model_id as "serviceModelId",
    state,sample_size as "sampleSize",recent_window as "recentWindow",
    live_brier::float as "liveBrier",live_log_loss::float as "liveLogLoss",
    live_calibration_error::float as "liveCalibrationError",
    live_brier_skill_score::float as "liveBrierSkillScore",market_brier::float as "marketBrier",
    training_holdout_brier::float as "trainingHoldoutBrier",brier_degradation::float as "brierDegradation",
    drift_score::float as "driftScore",prior_critical_runs as "priorCriticalRuns",action,reason,
    observed_at as "observedAt"
   from ml_champion_monitor_snapshots order by observed_at desc limit 500
  `;
  return {ok:true,source:'database' as const,latestRun:latestRun||null,champions,recent};
 }catch(error){
  return {ok:false,source:'database' as const,latestRun:null,champions:[],recent:[],error:error instanceof Error?error.message:'champion drift status failed'};
 }
}
