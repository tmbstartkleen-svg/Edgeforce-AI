import{t as e}from"./db-9LtqYd6N.js";import{t}from"./releaseManifest-bHjF1npa.js";import{n}from"./preventiveDecisionCalibration-B_erbWue.js";import{n as r}from"./preventiveThresholdProbation-36jOuLtj.js";function i(e){let t=[];if(e.probationStage<=0||e.probationState===`INACTIVE`)return{status:`INACTIVE`,degradationScore:0,rollbackStage:null,rationale:[`No active probation stage to evaluate.`]};let n=Math.max(0,e.currentCalibrationError-e.baselineCalibrationError),r=Math.max(0,e.currentBrierScore-e.baselineBrierScore),i=Math.max(Math.min(1,n/.1),Math.min(1,r/.12));if(i>=.7){let n=Math.max(0,e.probationStage-1);return t.push(`Probation performance degraded materially versus baseline; roll back one stage.`),{status:`ROLLBACK`,degradationScore:i,rollbackStage:n,rationale:t}}return i>=.4?(t.push(`Probation performance is weaker than baseline; hold the current stage.`),{status:`HOLD`,degradationScore:i,rollbackStage:null,rationale:t}):(t.push(`Probation performance remains within baseline tolerance.`),{status:`STABLE`,degradationScore:i,rollbackStage:null,rationale:t})}async function a(){let t=e();if(!t)return null;try{let[e]=await t`
   select calibration_error::float as "calibrationError",brier_score::float as "brierScore"
   from preventive_champion_baseline_state where singleton_key=1 and promoted_at is not null
  `;if(e)return e;let[n]=await t`
   select candidate_calibration_error::float as "calibrationError",
    candidate_brier_score::float as "brierScore"
   from preventive_baseline_succession_state
   where singleton_key=1 and status='READY'
  `;if(n)return n;let[r]=await t`
   select calibration_error::float as "calibrationError",brier_score::float as "brierScore"
   from preventive_threshold_recovery_snapshots
   where adaptive_reentry_allowed=true
   order by generated_at asc limit 1
  `;return r||null}catch{return null}}async function o(){let o=e(),[s,c,l,u]=await Promise.all([r(),n(),a(),o?o`select rollback_count as "rollbackCount" from preventive_probation_performance_state where singleton_key=1`:Promise.resolve([])]),d=i({baselineCalibrationError:Number(l?.calibrationError??c?.calibrationError??0),baselineBrierScore:Number(l?.brierScore??c?.brierScore??0),currentCalibrationError:Number(c?.calibrationError||0),currentBrierScore:Number(c?.brierScore||0),probationStage:Number(s?.stage||0),probationState:String(s?.state||`INACTIVE`)}),f=!1;if(o&&d.status===`ROLLBACK`&&d.rollbackStage!==null){let e=d.rollbackStage;await o`
   update preventive_threshold_probation_state
   set state=${e<=0?`REVERTED`:e===1?`STAGE_1`:e===2?`STAGE_2`:`STAGE_3`},stage=${e},stage_streak=0,adaptive_weight=${e<=0?0:e===1?.25:e===2?.5:.75},
    last_reason='V86 probation performance rollback applied.',updated_at=now()
   where singleton_key=1
  `,f=!0}let p=Number(u?.[0]?.rollbackCount||0)+(f?1:0);return o&&(await o`
   insert into preventive_probation_performance_state(
    singleton_key,status,baseline_calibration_error,baseline_brier_score,current_calibration_error,current_brier_score,
    degradation_score,stage_rollback_applied,rollback_count,last_reason,updated_at
   ) values(
    1,${d.status},${Number(l?.calibrationError??0)},${Number(l?.brierScore??0)},
    ${Number(c?.calibrationError||0)},${Number(c?.brierScore||0)},
    ${d.degradationScore},${f},${p},${d.rationale.join(` `)},now()
   )
   on conflict(singleton_key) do update set
    status=excluded.status,baseline_calibration_error=excluded.baseline_calibration_error,
    baseline_brier_score=excluded.baseline_brier_score,current_calibration_error=excluded.current_calibration_error,
    current_brier_score=excluded.current_brier_score,degradation_score=excluded.degradation_score,
    stage_rollback_applied=excluded.stage_rollback_applied,rollback_count=excluded.rollback_count,
    last_reason=excluded.last_reason,updated_at=now()
  `,await o`
   insert into preventive_probation_performance_snapshots(
    model_version,probation_state,probation_stage,adaptive_weight,status,degradation_score,rollback_applied,rationale
   ) values(
    ${t.modelVersion},${String(s?.state||`INACTIVE`)},${Number(s?.stage||0)},
    ${Number(s?.adaptiveWeight||0)},${d.status},${d.degradationScore},
    ${f},${o.json(d.rationale)}
   )
  `),{configured:!!o,...d,rollbackApplied:f,rollbackCount:p}}async function s(){let t=e();if(!t)return{status:`INACTIVE`,degradationScore:0,rollbackCount:0,stageRollbackApplied:!1,rationale:[],recent:[]};try{let[e]=await t`
   select status,degradation_score::float as "degradationScore",rollback_count as "rollbackCount",
    stage_rollback_applied as "stageRollbackApplied",last_reason as "lastReason",updated_at as "updatedAt"
   from preventive_probation_performance_state where singleton_key=1
  `,n=await t`
   select id,probation_state as "probationState",probation_stage as "probationStage",
    adaptive_weight::float as "adaptiveWeight",status,degradation_score::float as "degradationScore",
    rollback_applied as "rollbackApplied",generated_at as "generatedAt"
   from preventive_probation_performance_snapshots order by generated_at desc limit 20
  `;return{...e,rationale:e?.lastReason?[String(e.lastReason)]:[],recent:n}}catch{return{status:`INACTIVE`,degradationScore:0,rollbackCount:0,stageRollbackApplied:!1,rationale:[],recent:[]}}}export{s as n,o as r,i as t};