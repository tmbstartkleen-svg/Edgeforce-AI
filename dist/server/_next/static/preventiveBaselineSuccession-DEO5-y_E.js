import{t as e}from"./db-9LtqYd6N.js";import{t}from"./releaseManifest-bHjF1npa.js";import{t as n}from"./preventiveChampionBaseline-CxqOD8Ok.js";import{n as r}from"./preventiveChampionBaselineHealth-DP0O6LOy.js";var i=e=>Math.max(0,Math.min(1,e));function a(e){let t=[];if(e.hasActiveChampion&&!e.championRetired)return{status:`IDLE`,readinessScore:0,candidate:null,sourceWindows:0,rationale:[`Active champion baseline remains healthy; no successor is needed.`]};if(e.windows.length<3)return{status:`BUILDING`,readinessScore:0,candidate:null,sourceWindows:e.windows.length,rationale:[`At least three recent calibration windows are required to validate a replacement candidate.`]};let n=e.windows.slice(-5),r=n.reduce((e,t)=>e+t.calibrationError,0)/n.length,a=n.reduce((e,t)=>e+t.brierScore,0)/n.length,o=n[n.length-1]?.sampleSize||0,s=Math.max(...n.map(e=>e.calibrationError))-Math.min(...n.map(e=>e.calibrationError)),c=Math.max(...n.map(e=>e.brierScore))-Math.min(...n.map(e=>e.brierScore)),l=1-i(Math.max(s/.08,c/.1)),u=1-i(Math.max((r-.06)/.12,(a-.14)/.16)),d=i(o/30),f=i(l*.4+u*.4+d*.2),p={calibrationError:r,brierScore:a,sampleSize:o};return f>=.75&&r<=.1&&a<=.2&&o>=20?(t.push(`Replacement baseline is READY: recent windows are stable, healthy, and sufficiently mature.`),{status:`READY`,readinessScore:f,candidate:p,sourceWindows:n.length,rationale:t}):f>=.5?(t.push(`Replacement baseline is a CANDIDATE but needs more stability or evidence before use.`),{status:`CANDIDATE`,readinessScore:f,candidate:p,sourceWindows:n.length,rationale:t}):(t.push(`Replacement evidence is not yet strong enough; continue using the recovery baseline fallback.`),{status:`BUILDING`,readinessScore:f,candidate:p,sourceWindows:n.length,rationale:t})}async function o(){let t=e();return t?(await t`
  select calibration_error::float as "calibrationError",brier_score::float as "brierScore",sample_size as "sampleSize"
  from preventive_decision_calibration_snapshots
  order by generated_at desc limit 5
 `).reverse().map(e=>({calibrationError:Number(e.calibrationError||0),brierScore:Number(e.brierScore||0),sampleSize:Number(e.sampleSize||0)})):[]}async function s(){let i=e(),[s,c,l]=await Promise.all([n(),r(),o()]),u=a({hasActiveChampion:!!s?.promotedAt,championRetired:!!c?.retired||String(s?.source||``).includes(`RETIRED`),windows:l}),d=u.candidate;return i?(await i`
  insert into preventive_baseline_succession_state(
   singleton_key,status,candidate_calibration_error,candidate_brier_score,candidate_sample_size,
   readiness_score,source_windows,last_reason,updated_at
  ) values(
   1,${u.status},${d?.calibrationError||0},${d?.brierScore||0},${d?.sampleSize||0},
   ${u.readinessScore},${u.sourceWindows},${u.rationale.join(` `)},now()
  )
  on conflict(singleton_key) do update set
   status=excluded.status,candidate_calibration_error=excluded.candidate_calibration_error,
   candidate_brier_score=excluded.candidate_brier_score,candidate_sample_size=excluded.candidate_sample_size,
   readiness_score=excluded.readiness_score,source_windows=excluded.source_windows,
   last_reason=excluded.last_reason,updated_at=now()
 `,await i`
  insert into preventive_baseline_succession_snapshots(
   model_version,status,candidate_calibration_error,candidate_brier_score,candidate_sample_size,
   readiness_score,source_windows,rationale
  ) values(
   ${t.modelVersion},${u.status},${d?.calibrationError||0},${d?.brierScore||0},
   ${d?.sampleSize||0},${u.readinessScore},${u.sourceWindows},${i.json(u.rationale)}
  )
 `,{configured:!0,...u}):{configured:!1,...u}}async function c(){let t=e();if(!t)return{status:`IDLE`,readinessScore:0,candidateCalibrationError:0,candidateBrierScore:0,candidateSampleSize:0,sourceWindows:0,rationale:[],recent:[]};try{let[e]=await t`
   select status,candidate_calibration_error::float as "candidateCalibrationError",
    candidate_brier_score::float as "candidateBrierScore",candidate_sample_size as "candidateSampleSize",
    readiness_score::float as "readinessScore",source_windows as "sourceWindows",
    last_reason as "lastReason",updated_at as "updatedAt"
   from preventive_baseline_succession_state where singleton_key=1
  `,n=await t`
   select id,status,readiness_score::float as "readinessScore",source_windows as "sourceWindows",generated_at as "generatedAt"
   from preventive_baseline_succession_snapshots order by generated_at desc limit 20
  `;return{...e,rationale:e?.lastReason?[String(e.lastReason)]:[],recent:n}}catch{return{status:`IDLE`,readinessScore:0,candidateCalibrationError:0,candidateBrierScore:0,candidateSampleSize:0,sourceWindows:0,rationale:[],recent:[]}}}export{c as n,s as r,a as t};