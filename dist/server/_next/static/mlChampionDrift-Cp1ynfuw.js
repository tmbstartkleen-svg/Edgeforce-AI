import{t as e}from"./db-9LtqYd6N.js";import{t}from"./releaseManifest-bHjF1npa.js";var n=(e,t=1e-4,n=.9999)=>Math.max(t,Math.min(n,e)),r=e=>e.length?e.reduce((e,t)=>e+t,0)/e.length:0;function i(e){if(!e.length)return 0;let t=new Map;for(let r of e){let e=Math.min(9,Math.floor(n(r.probability,0,.999999)*10)),i=t.get(e)||{p:[],y:[]};i.p.push(r.probability),i.y.push(r.outcome),t.set(e,i)}let i=0;for(let e of t.values())i+=Math.abs(r(e.p)-r(e.y))*e.p.length;return i/e.length}function a(e,t){let a=e.filter(e=>Number.isFinite(e.probability)&&e.probability>0&&e.probability<1&&(e.outcome===0||e.outcome===1)&&Number.isFinite(e.marketBaselineProbability)&&e.marketBaselineProbability>0&&e.marketBaselineProbability<1);if(!a.length)return{sampleSize:0,liveBrier:0,liveLogLoss:0,liveCalibrationError:0,marketBrier:0,liveBrierSkillScore:0,brierDegradation:0,driftScore:0};let o=r(a.map(e=>(e.probability-e.outcome)**2)),s=r(a.map(e=>(e.marketBaselineProbability-e.outcome)**2)),c=r(a.map(e=>-(e.outcome*Math.log(n(e.probability))+(1-e.outcome)*Math.log(n(1-e.probability))))),l=i(a),u=s>0?1-o/s:0,d=o-t,f=Math.max(0,Math.max(0,-u)/.08,Math.max(0,d)/.06,Math.max(0,l-.08)/.08);return{sampleSize:a.length,liveBrier:o,liveLogLoss:c,liveCalibrationError:l,marketBrier:s,liveBrierSkillScore:u,brierDegradation:d,driftScore:f}}function o(e){let t=e.minSample??Math.max(20,Number(process.env.ML_CHAMPION_DRIFT_MIN_SAMPLE||30));return e.sampleSize<t?{state:`INSUFFICIENT`,action:`NONE`,reason:`Need `+t+` settled live predictions; have `+e.sampleSize}:e.liveBrierSkillScore<=Number(process.env.ML_CHAMPION_CRITICAL_SKILL||-.08)||e.brierDegradation>=Number(process.env.ML_CHAMPION_CRITICAL_BRIER_DELTA||.06)||e.liveCalibrationError>=Number(process.env.ML_CHAMPION_CRITICAL_CALIBRATION||.16)?(e.previousCriticalRuns??0)>=1?{state:`CRITICAL`,action:`QUARANTINE`,reason:`Critical drift repeated: skill `+e.liveBrierSkillScore.toFixed(3)+`, Brier delta `+e.brierDegradation.toFixed(3)+`, calibration `+e.liveCalibrationError.toFixed(3)}:{state:`CRITICAL`,action:`NONE`,reason:`Critical drift detected; one confirmation run required before quarantine`}:e.liveBrierSkillScore<Number(process.env.ML_CHAMPION_WATCH_SKILL||0)||e.brierDegradation>=Number(process.env.ML_CHAMPION_WATCH_BRIER_DELTA||.03)||e.liveCalibrationError>=Number(process.env.ML_CHAMPION_WATCH_CALIBRATION||.11)?{state:`WATCH`,action:`NONE`,reason:`Performance weakening: skill `+e.liveBrierSkillScore.toFixed(3)+`, Brier delta `+e.brierDegradation.toFixed(3)+`, calibration `+e.liveCalibrationError.toFixed(3)}:{state:`HEALTHY`,action:`NONE`,reason:`Live champion remains within market-relative drift guardrails`}}function s(){let e=String(process.env.ML_RETIRE_SERVICE_URL||``).trim();if(e)return e;for(let e of[process.env.ML_PROMOTION_SERVICE_URL,process.env.ML_TRAINING_SERVICE_URL,process.env.ML_PREDICTION_SERVICE_URL]){let t=String(e||``).trim();if(t)try{let e=new URL(t);return e.pathname=`/retire`,e.search=``,e.hash=``,e.toString()}catch{}}return``}async function c(e,t){let n=s();if(!n)return{ok:!1,error:`ML retirement endpoint is not configured`};let r=String(process.env.ML_TRAINING_SERVICE_KEY||process.env.ML_PREDICTION_SERVICE_KEY||process.env.EXPERT_MODEL_SERVICE_KEY||``).trim(),i=new AbortController,a=setTimeout(()=>i.abort(),Math.max(2e3,Number(process.env.ML_RETIRE_TIMEOUT_MS||1e4)));try{let a=await fetch(n,{method:`POST`,headers:{"content-type":`application/json`,accept:`application/json`,...r?{authorization:`Bearer `+r}:{}},body:JSON.stringify({schemaVersion:`edgeforce-ml-retire-v1`,sport:e.sport,marketKey:e.marketKey,serviceModelId:e.serviceModelId,reason:t}),cache:`no-store`,signal:i.signal}),o=await a.json().catch(()=>({}));if(!a.ok||o.ok!==!0)throw Error(o.detail||`ML retire HTTP `+a.status);return{ok:!0,retired:!!o.retired,body:o}}catch(e){return{ok:!1,error:e instanceof Error?e.message:`ML retirement failed`}}finally{clearTimeout(a)}}async function l(t){let n=e();if(!n)return{matched:0,settled:0,mode:`dry-run`};let r=0,i=0;for(let e of t){if(e.result===`push`)continue;let t=await n`
   update external_ml_prediction_snapshots
   set outcome=${e.result===`win`?1:0},settled_at=${e.settledAt||new Date().toISOString()},
       closing_odds=${e.closingOdds??null}
   where market_id=${e.eventId}
     and outcome is null
     and (${e.marketKey??null}::text is null or lower(market_key)=lower(${e.marketKey??``}))
     and lower(coalesce(metadata->>'selection',''))=lower(${e.selectionKey})
   returning id
  `;r+=t.length,i+=t.length}return{matched:r,settled:i,mode:`database`}}async function u(){let t=e();return t?await t`
  select sport,market_key as "marketKey",algorithm,service_model_id as "serviceModelId",
   holdout_brier::float as "holdoutBrier",holdout_log_loss::float as "holdoutLogLoss",
   calibration_error::float as "calibrationError",brier_skill_score::float as "brierSkillScore",
   active,status
  from external_ml_champions
  where active=true and status='ACTIVE'
  order by sport,market_key
 `:[]}async function d(t,n){let r=e();return r?await r`
  select probability::float,outcome,
   coalesce(market_baseline_probability,(metadata->>'marketProbability')::float)::float as "marketBaselineProbability",
   settled_at as "settledAt"
  from external_ml_prediction_snapshots
  where service_model_id=${t} and outcome is not null
   and coalesce(market_baseline_probability,(metadata->>'marketProbability')::float) is not null
  order by settled_at desc
  limit ${Math.max(1,Math.min(1e3,n))}
 `:[]}async function f(t,n){let r=e();if(!r)return 0;let i=await r`
  select state,sample_size as "sampleSize" from ml_champion_monitor_snapshots
  where service_model_id=${t}
  order by observed_at desc limit 2
 `,a=0,o=n;for(let e of i){let t=Number(e.sampleSize||0);if(String(e.state)!==`CRITICAL`||t>=o)break;a++,o=t}return a}async function p(){let n=e();if(!n)return{ok:!0,mode:`dry-run`,champions:0,healthy:0,watch:0,critical:0,quarantined:0,insufficient:0,rows:[]};let[r]=await n`
  insert into ml_champion_monitor_runs(model_version,status,started_at)
  values(${t.modelVersion},'running',now())
  returning id
 `,i=Math.max(20,Number(process.env.ML_CHAMPION_DRIFT_WINDOW||100)),s=Math.max(20,Number(process.env.ML_CHAMPION_DRIFT_MIN_SAMPLE||30)),l=[],p=0,m=0,h=0,g=0,_=0;try{for(let e of await u()){let u=a(await d(e.serviceModelId,i),e.holdoutBrier),v=await f(e.serviceModelId,u.sampleSize),y=o({...u,previousCriticalRuns:v,minSample:s}),b=y.action,x=y.state,S=y.reason;if(x===`HEALTHY`?p++:x===`WATCH`?m++:x===`INSUFFICIENT`?_++:h++,b===`QUARANTINE`){let r=await c(e,S);r.ok?(await n`
      update external_ml_champions set
       active=false,status='QUARANTINED',quarantined_at=now(),quarantine_reason=${S},
       last_monitor_at=now(),live_sample_size=${u.sampleSize},
       live_brier=${u.liveBrier},live_log_loss=${u.liveLogLoss},
       live_calibration_error=${u.liveCalibrationError},
       live_brier_skill_score=${u.liveBrierSkillScore},live_drift_score=${u.driftScore}
      where sport=${e.sport} and market_key=${e.marketKey}
       and service_model_id=${e.serviceModelId} and active=true
     `,await n`
      insert into external_ml_champion_history(
       sport,market_key,algorithm,service_model_id,action,composite_score,brier_skill_score,
       holdout_brier,holdout_log_loss,calibration_error,reason,model_version,metadata,recorded_at
      ) select sport,market_key,algorithm,service_model_id,'QUARANTINED',composite_score,brier_skill_score,
       holdout_brier,holdout_log_loss,calibration_error,${S},${t.modelVersion},
       ${n.json({liveSampleSize:u.sampleSize,liveBrier:u.liveBrier,liveBrierSkillScore:u.liveBrierSkillScore,liveCalibrationError:u.liveCalibrationError,driftScore:u.driftScore})},now()
      from external_ml_champions
      where sport=${e.sport} and market_key=${e.marketKey}
       and service_model_id=${e.serviceModelId}
     `,g++,b=`QUARANTINED`,S+=`; hosted champion retired and EdgeForce reverted to native-model fallback`):(b=`RETIRE_FAILED`,S+=`; quarantine blocked because hosted retirement failed: `+r.error)}else await n`
     update external_ml_champions set
      last_monitor_at=now(),live_sample_size=${u.sampleSize},
      live_brier=${u.liveBrier},live_log_loss=${u.liveLogLoss},
      live_calibration_error=${u.liveCalibrationError},
      live_brier_skill_score=${u.liveBrierSkillScore},live_drift_score=${u.driftScore}
     where sport=${e.sport} and market_key=${e.marketKey}
      and service_model_id=${e.serviceModelId}
    `;await n`
    insert into ml_champion_monitor_snapshots(
     monitor_run_id,sport,market_key,algorithm,service_model_id,state,sample_size,recent_window,
     live_brier,live_log_loss,live_calibration_error,live_brier_skill_score,market_brier,
     training_holdout_brier,brier_degradation,drift_score,prior_critical_runs,action,reason,metrics,
     model_version,observed_at
    ) values(
     ${r.id},${e.sport},${e.marketKey},${e.algorithm},${e.serviceModelId},
     ${x},${u.sampleSize},${i},${u.liveBrier},${u.liveLogLoss},
     ${u.liveCalibrationError},${u.liveBrierSkillScore},${u.marketBrier},
     ${e.holdoutBrier},${u.brierDegradation},${u.driftScore},${v},
     ${b},${S},${n.json({trainingHoldoutLogLoss:e.holdoutLogLoss,trainingCalibrationError:e.calibrationError,trainingBrierSkillScore:e.brierSkillScore})},
     ${t.modelVersion},now()
    )
   `,l.push({champion:e,...u,state:x,action:b,reason:S,priorCritical:v})}return await n`
   update ml_champion_monitor_runs set
    status='completed',completed_at=now(),champions_checked=${l.length},
    healthy=${p},watch=${m},critical=${h},quarantined=${g},insufficient=${_}
   where id=${r.id}
  `,{ok:!0,mode:`database`,runId:Number(r.id),champions:l.length,healthy:p,watch:m,critical:h,quarantined:g,insufficient:_,rows:l}}catch(e){throw await n`
   update ml_champion_monitor_runs set status='failed',completed_at=now(),
    error_text=${e instanceof Error?e.message:`champion drift monitor failed`}
   where id=${r.id}
  `.catch(()=>void 0),e}}async function m(){let t=e();if(!t)return{ok:!0,source:`none`,latestRun:null,champions:[],recent:[]};try{let[e]=await t`
   select id,model_version as "modelVersion",status,champions_checked as "championsChecked",
    healthy,watch,critical,quarantined,insufficient,error_text as error,
    started_at as "startedAt",completed_at as "completedAt"
   from ml_champion_monitor_runs order by started_at desc limit 1
  `,n=await t`
   select sport,market_key as "marketKey",algorithm,service_model_id as "serviceModelId",
    active,status,promoted_at as "promotedAt",quarantined_at as "quarantinedAt",
    quarantine_reason as "quarantineReason",last_monitor_at as "lastMonitorAt",
    live_sample_size as "liveSampleSize",live_brier::float as "liveBrier",
    live_log_loss::float as "liveLogLoss",live_calibration_error::float as "liveCalibrationError",
    live_brier_skill_score::float as "liveBrierSkillScore",live_drift_score::float as "liveDriftScore",
    holdout_brier::float as "holdoutBrier",brier_skill_score::float as "trainingBrierSkillScore"
   from external_ml_champions order by active desc,sport,market_key
  `,r=await t`
   select sport,market_key as "marketKey",algorithm,service_model_id as "serviceModelId",
    state,sample_size as "sampleSize",recent_window as "recentWindow",
    live_brier::float as "liveBrier",live_log_loss::float as "liveLogLoss",
    live_calibration_error::float as "liveCalibrationError",
    live_brier_skill_score::float as "liveBrierSkillScore",market_brier::float as "marketBrier",
    training_holdout_brier::float as "trainingHoldoutBrier",brier_degradation::float as "brierDegradation",
    drift_score::float as "driftScore",prior_critical_runs as "priorCriticalRuns",action,reason,
    observed_at as "observedAt"
   from ml_champion_monitor_snapshots order by observed_at desc limit 500
  `;return{ok:!0,source:`database`,latestRun:e||null,champions:n,recent:r}}catch(e){return{ok:!1,source:`database`,latestRun:null,champions:[],recent:[],error:e instanceof Error?e.message:`champion drift status failed`}}}export{l as a,p as i,m as n,a as r,o as t};