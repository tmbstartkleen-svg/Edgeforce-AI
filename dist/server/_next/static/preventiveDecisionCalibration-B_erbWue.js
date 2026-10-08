import{t as e}from"./db-9LtqYd6N.js";import{t}from"./releaseManifest-bHjF1npa.js";var n=e=>Math.max(0,Math.min(1,e));function r(e){let t=e.filter(e=>e.decision!==`NO_ACTION`);if(!t.length)return{sampleSize:0,brierScore:0,calibrationError:0,recommendSuccessRate:0,holdSuccessRate:0,rejectSuccessRate:0,profiles:[]};let r=[`RECOMMEND`,`HOLD_FOR_EVIDENCE`,`DO_NOT_USE`].map(e=>{let n=t.filter(t=>t.decision===e),r=n.length,i=r?n.reduce((e,t)=>e+t.gateScore,0)/r:0,a=r?n.filter(e=>e.calibratedSuccess).length/r:0;return{decision:e,sampleSize:r,meanScore:i,successRate:a,error:Math.abs(i-a)}}),i=t.reduce((e,t)=>e+(t.gateScore-(t.calibratedSuccess?1:0))**2,0)/t.length,a=r.reduce((e,t)=>e+t.error*t.sampleSize,0)/t.length,o=e=>r.find(t=>t.decision===e)?.successRate||0;return{sampleSize:t.length,brierScore:n(i),calibrationError:n(a),recommendSuccessRate:o(`RECOMMEND`),holdSuccessRate:o(`HOLD_FOR_EVIDENCE`),rejectSuccessRate:o(`DO_NOT_USE`),profiles:r}}async function i(){let t=e();if(!t)return{evaluated:0};let n=await t`
  select s.id,s.predicted_cause as "predictedCause",s.decision,s.action_key as "actionKey",s.gate_score::float as "gateScore",s.generated_at as "generatedAt"
  from preventive_action_decision_snapshots s
  left join preventive_decision_outcomes o on o.decision_snapshot_id=s.id
  where o.id is null and s.generated_at<=now()-interval '24 hours'
  order by s.generated_at asc
  limit 200
 `,r=0;for(let e of n){let n=(await t`
   select 1 from incident_attribution_snapshots
   where primary_cause=${String(e.predictedCause)}
    and severity='ACTION'
    and observed_at>${new Date(e.generatedAt).toISOString()}
    and observed_at<=${new Date(e.generatedAt).toISOString()}::timestamptz+interval '24 hours'
   limit 1
  `).length>0,i=String(e.decision),a=i===`RECOMMEND`?!n:i===`DO_NOT_USE`?n:!0;await t`
   insert into preventive_decision_outcomes(
    decision_snapshot_id,predicted_cause,decision,gate_score,action_key,evaluated_at,matching_action_incident,calibrated_success
   ) values(
    ${Number(e.id)},${String(e.predictedCause)},${i},${Number(e.gateScore||0)},
    ${e.actionKey?String(e.actionKey):null},now(),${n},${a}
   )
   on conflict(decision_snapshot_id) do nothing
  `,r++}return{evaluated:r}}async function a(){let t=e();return t?(await t`
  select decision,gate_score::float as "gateScore",calibrated_success as "calibratedSuccess"
  from preventive_decision_outcomes
  where evaluated_at is not null and created_at>=now()-interval '90 days'
  order by created_at asc
 `).map(e=>({decision:String(e.decision),gateScore:Number(e.gateScore||0),calibratedSuccess:!!e.calibratedSuccess})):[]}async function o(){let n=await i(),o=e();if(!o)return{configured:!1,evaluatedNow:n.evaluated,...r([])};let s=r(await a());return await o`
  insert into preventive_decision_calibration_snapshots(
   model_version,sample_size,brier_score,calibration_error,recommend_success_rate,hold_success_rate,reject_success_rate,profiles
  ) values(
   ${t.modelVersion},${s.sampleSize},${s.brierScore},${s.calibrationError},
   ${s.recommendSuccessRate},${s.holdSuccessRate},${s.rejectSuccessRate},${o.json(s.profiles)}
  )
 `,{configured:!0,evaluatedNow:n.evaluated,...s}}async function s(){let t=e();if(!t)return{generatedAt:new Date().toISOString(),...r([]),recent:[]};try{let[e]=await t`
   select sample_size as "sampleSize",brier_score::float as "brierScore",calibration_error::float as "calibrationError",
    recommend_success_rate::float as "recommendSuccessRate",hold_success_rate::float as "holdSuccessRate",
    reject_success_rate::float as "rejectSuccessRate",profiles,generated_at as "generatedAt"
   from preventive_decision_calibration_snapshots order by generated_at desc limit 1
  `,n=await t`
   select id,sample_size as "sampleSize",brier_score::float as "brierScore",calibration_error::float as "calibrationError",
    generated_at as "generatedAt"
   from preventive_decision_calibration_snapshots order by generated_at desc limit 20
  `;return e?{...e,recent:n}:{generatedAt:new Date().toISOString(),...r([]),recent:n}}catch{return{generatedAt:new Date().toISOString(),...r([]),recent:[]}}}export{s as n,o as r,r as t};