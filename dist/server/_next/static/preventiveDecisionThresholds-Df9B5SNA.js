import{t as e}from"./db-9LtqYd6N.js";import{t}from"./releaseManifest-bHjF1npa.js";import{n}from"./preventiveDecisionCalibration-B_erbWue.js";import{t as r}from"./preventiveThresholdRecovery-Dn_NL5jw.js";import{t as i}from"./preventiveThresholdProbation-36jOuLtj.js";var a=(e,t,n)=>Math.max(t,Math.min(n,e)),o={recommendThreshold:.72,confidenceFloor:.45,riskFloor:.6,rejectEffectivenessCeiling:.38};function s(e,t){let n=a(t,0,1);return{...e,recommendThreshold:o.recommendThreshold+(e.recommendThreshold-o.recommendThreshold)*n,confidenceFloor:o.confidenceFloor+(e.confidenceFloor-o.confidenceFloor)*n,riskFloor:o.riskFloor+(e.riskFloor-o.riskFloor)*n,rejectEffectivenessCeiling:o.rejectEffectivenessCeiling+(e.rejectEffectivenessCeiling-o.rejectEffectivenessCeiling)*n,rationale:[...e.rationale,`V85 adaptive influence applied at ${Math.round(n*100)}%.`]}}function c(e){let t=o,n=[],r=`BASELINE`,i=t.recommendThreshold,s=t.confidenceFloor,c=t.riskFloor,l=t.rejectEffectivenessCeiling;if(e.sampleSize<12)n.push(`Insufficient calibration history; baseline thresholds retained.`);else{let t=e.calibrationError>.15||e.brierScore>.24||e.recommendSuccessRate<.6,a=e.calibrationError<.08&&e.brierScore<.16&&e.recommendSuccessRate>=.75;t?(r=`CONSERVATIVE`,i+=.06,s+=.1,c+=.05,l-=.04,n.push(`Calibration quality is weak; thresholds tightened within safety bounds.`)):a?(r=`TUNED`,i-=.02,s-=.03,c-=.02,l+=e.rejectSuccessRate>=.7?.02:0,n.push(`Calibration is strong; minor bounded tuning applied.`)):n.push(`Calibration is acceptable; baseline thresholds retained.`)}return{recommendThreshold:a(i,.7,.82),confidenceFloor:a(s,.42,.6),riskFloor:a(c,.58,.72),rejectEffectivenessCeiling:a(l,.3,.42),sourceSampleSize:e.sampleSize,sourceBrierScore:e.brierScore,sourceCalibrationError:e.calibrationError,mode:r,rationale:n}}async function l(e){let t=e||await n();return c({sampleSize:Number(t.sampleSize||0),brierScore:Number(t.brierScore||0),calibrationError:Number(t.calibrationError||0),recommendSuccessRate:Number(t.recommendSuccessRate||0),rejectSuccessRate:Number(t.rejectSuccessRate||0)})}async function u(n){let r=e();return r?(await r`
  insert into preventive_decision_threshold_state(
   singleton_key,recommend_threshold,confidence_floor,risk_floor,reject_effectiveness_ceiling,
   source_sample_size,source_brier_score,source_calibration_error,mode,rationale,updated_at
  ) values(
   1,${n.recommendThreshold},${n.confidenceFloor},${n.riskFloor},${n.rejectEffectivenessCeiling},
   ${n.sourceSampleSize},${n.sourceBrierScore},${n.sourceCalibrationError},${n.mode},
   ${r.json(n.rationale)},now()
  )
  on conflict(singleton_key) do update set
   recommend_threshold=excluded.recommend_threshold,confidence_floor=excluded.confidence_floor,
   risk_floor=excluded.risk_floor,reject_effectiveness_ceiling=excluded.reject_effectiveness_ceiling,
   source_sample_size=excluded.source_sample_size,source_brier_score=excluded.source_brier_score,
   source_calibration_error=excluded.source_calibration_error,mode=excluded.mode,rationale=excluded.rationale,updated_at=now()
 `,await r`
  insert into preventive_decision_threshold_snapshots(
   model_version,recommend_threshold,confidence_floor,risk_floor,reject_effectiveness_ceiling,
   source_sample_size,source_brier_score,source_calibration_error,mode,rationale
  ) values(
   ${t.modelVersion},${n.recommendThreshold},${n.confidenceFloor},${n.riskFloor},
   ${n.rejectEffectivenessCeiling},${n.sourceSampleSize},${n.sourceBrierScore},
   ${n.sourceCalibrationError},${n.mode},${r.json(n.rationale)}
  )
 `,{persisted:!0}):{persisted:!1}}async function d(e){if(!await r())return{...await f(),persisted:!1,reentryAllowed:!1,governorState:`RECOVERY_LOCK`};let t=await i(),n=s(await l(e?.calibration),t),a=await u(n);return{...n,persistence:a,reentryAllowed:!0,adaptiveWeight:t,governorState:t<1?`PROBATION`:`ADAPTIVE`}}async function f(){let t=e();if(!t)return l();try{let[e]=await t`
   select recommend_threshold::float as "recommendThreshold",confidence_floor::float as "confidenceFloor",
    risk_floor::float as "riskFloor",reject_effectiveness_ceiling::float as "rejectEffectivenessCeiling",
    source_sample_size as "sourceSampleSize",source_brier_score::float as "sourceBrierScore",
    source_calibration_error::float as "sourceCalibrationError",mode,rationale
   from preventive_decision_threshold_state where singleton_key=1
  `;return e?{recommendThreshold:Number(e.recommendThreshold),confidenceFloor:Number(e.confidenceFloor),riskFloor:Number(e.riskFloor),rejectEffectivenessCeiling:Number(e.rejectEffectivenessCeiling),sourceSampleSize:Number(e.sourceSampleSize||0),sourceBrierScore:Number(e.sourceBrierScore||0),sourceCalibrationError:Number(e.sourceCalibrationError||0),mode:String(e.mode),rationale:Array.isArray(e.rationale)?e.rationale.map(String):[]}:l()}catch{return l()}}export{f as n,d as r,c as t};