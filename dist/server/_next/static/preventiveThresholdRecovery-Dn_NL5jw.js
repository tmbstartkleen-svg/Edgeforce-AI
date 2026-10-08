import{t as e}from"./db-9LtqYd6N.js";import{t}from"./releaseManifest-bHjF1npa.js";import{n}from"./preventiveDecisionCalibration-B_erbWue.js";import{n as r}from"./preventiveThresholdStability-B6cr-8r-.js";function i(e){let t=[];if(e.rollbackApplied||e.instabilityScore>=.72)return t.push(`Threshold rollback or severe instability detected; adaptive tuning is locked.`),{state:`LOCKED`,recoveryStreak:0,adaptiveReentryAllowed:!1,rationale:t};let n=e.sampleSize>=12&&e.instabilityScore<.35&&e.calibrationError<=.1&&e.brierScore<=.2;if(e.previousState===`LOCKED`)return n?(t.push(`First healthy recovery window passed; entering monitored recovery.`),{state:`RECOVERING`,recoveryStreak:1,adaptiveReentryAllowed:!1,rationale:t}):(t.push(`Recovery evidence is not yet strong enough to leave the locked state.`),{state:`LOCKED`,recoveryStreak:0,adaptiveReentryAllowed:!1,rationale:t});if(e.previousState===`RECOVERING`){if(!n)return t.push(`Recovery evidence regressed; adaptive tuning is locked again.`),{state:`LOCKED`,recoveryStreak:0,adaptiveReentryAllowed:!1,rationale:t};let r=e.recoveryStreak+1;return r>=3?(t.push(`Three consecutive healthy recovery windows passed; bounded adaptive tuning may resume.`),{state:`OPEN`,recoveryStreak:r,adaptiveReentryAllowed:!0,rationale:t}):(t.push(`Healthy recovery window ${r}/3 passed.`),{state:`RECOVERING`,recoveryStreak:r,adaptiveReentryAllowed:!1,rationale:t})}return t.push(n?`Adaptive threshold tuning remains open under healthy evidence.`:`Evidence is below re-entry quality targets, but no active rollback lock exists.`),{state:`OPEN`,recoveryStreak:0,adaptiveReentryAllowed:!0,rationale:t}}async function a(){let t=e();if(!t)return null;try{let[e]=await t`
   select state,recovery_streak as "recoveryStreak",rollback_reference_id as "rollbackReferenceId",
    adaptive_reentry_allowed as "adaptiveReentryAllowed",last_reason as "lastReason"
   from preventive_threshold_recovery_state where singleton_key=1
  `;return e||null}catch{return null}}async function o(){let o=e(),[s,c,l]=await Promise.all([r(),n(),a()]),u={...i({previousState:String(l?.state||`OPEN`),recoveryStreak:Number(l?.recoveryStreak||0),rollbackApplied:!!s?.rollbackApplied,instabilityScore:Number(s?.instabilityScore||0),calibrationError:Number(c?.calibrationError||0),brierScore:Number(c?.brierScore||0),sampleSize:Number(c?.sampleSize||0)}),calibrationError:Number(c?.calibrationError||0),brierScore:Number(c?.brierScore||0),sampleSize:Number(c?.sampleSize||0),instabilityScore:Number(s?.instabilityScore||0),rollbackReferenceId:s?.lastSafeSnapshotId?Number(s.lastSafeSnapshotId):null};return o?(await o`
  insert into preventive_threshold_recovery_state(
   singleton_key,state,recovery_streak,rollback_reference_id,adaptive_reentry_allowed,last_reason,updated_at
  ) values(
   1,${u.state},${u.recoveryStreak},${u.rollbackReferenceId},
   ${u.adaptiveReentryAllowed},${u.rationale.join(` `)},now()
  )
  on conflict(singleton_key) do update set
   state=excluded.state,recovery_streak=excluded.recovery_streak,
   rollback_reference_id=excluded.rollback_reference_id,adaptive_reentry_allowed=excluded.adaptive_reentry_allowed,
   last_reason=excluded.last_reason,updated_at=now()
 `,await o`
  insert into preventive_threshold_recovery_snapshots(
   model_version,state,recovery_streak,rollback_reference_id,adaptive_reentry_allowed,
   calibration_error,brier_score,instability_score,rationale
  ) values(
   ${t.modelVersion},${u.state},${u.recoveryStreak},${u.rollbackReferenceId},
   ${u.adaptiveReentryAllowed},${u.calibrationError},${u.brierScore},
   ${u.instabilityScore},${o.json(u.rationale)}
  )
 `,{configured:!0,...u}):{configured:!1,...u}}async function s(){let t=e();if(!t)return{state:`OPEN`,recoveryStreak:0,rollbackReferenceId:null,adaptiveReentryAllowed:!0,rationale:[`Database is not configured.`],updatedAt:null,recent:[]};try{let[e]=await t`
   select state,recovery_streak as "recoveryStreak",rollback_reference_id as "rollbackReferenceId",
    adaptive_reentry_allowed as "adaptiveReentryAllowed",last_reason as "lastReason",updated_at as "updatedAt"
   from preventive_threshold_recovery_state where singleton_key=1
  `,n=await t`
   select id,state,recovery_streak as "recoveryStreak",adaptive_reentry_allowed as "adaptiveReentryAllowed",
    calibration_error::float as "calibrationError",brier_score::float as "brierScore",
    instability_score::float as "instabilityScore",generated_at as "generatedAt"
   from preventive_threshold_recovery_snapshots order by generated_at desc limit 20
  `;return{state:String(e?.state||`OPEN`),recoveryStreak:Number(e?.recoveryStreak||0),rollbackReferenceId:e?.rollbackReferenceId==null?null:Number(e.rollbackReferenceId),adaptiveReentryAllowed:e?.adaptiveReentryAllowed!==!1,rationale:e?.lastReason?[String(e.lastReason)]:[],updatedAt:e?.updatedAt?new Date(e.updatedAt).toISOString():null,recent:n}}catch{return{state:`OPEN`,recoveryStreak:0,rollbackReferenceId:null,adaptiveReentryAllowed:!0,rationale:[],updatedAt:null,recent:[]}}}async function c(){return(await s())?.adaptiveReentryAllowed!==!1}export{o as i,s as n,i as r,c as t};