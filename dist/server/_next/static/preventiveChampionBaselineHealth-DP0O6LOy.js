import{t as e}from"./db-9LtqYd6N.js";import{t}from"./releaseManifest-bHjF1npa.js";import{n}from"./preventiveDecisionCalibration-B_erbWue.js";import{t as r}from"./preventiveChampionBaseline-CxqOD8Ok.js";function i(e){let t=[];if(!e.hasChampion)return{status:`NO_CHAMPION`,driftScore:0,retire:!1,rationale:[`No promoted champion baseline is active.`]};let n=Math.max(0,e.currentCalibrationError-e.championCalibrationError),r=Math.max(0,e.currentBrierScore-e.championBrierScore),i=Math.max(Math.min(1,n/.1),Math.min(1,r/.12)),a=e.ageDays>=60?1:e.ageDays>=30?.5:0,o=Math.max(i,a*.6);return o>=.75?(t.push(`Champion baseline is stale or materially misaligned with current calibration and should be retired.`),{status:`RETIRE`,driftScore:o,retire:!0,rationale:t}):o>=.4?(t.push(`Champion baseline drift is elevated; continue monitoring before retirement.`),{status:`WATCH`,driftScore:o,retire:!1,rationale:t}):(t.push(`Champion baseline remains aligned with current healthy calibration.`),{status:`ACTIVE`,driftScore:o,retire:!1,rationale:t})}async function a(){let a=e(),[o,s,c]=await Promise.all([r(),n(),a?a`select retirement_count as "retirementCount" from preventive_champion_baseline_health_state where singleton_key=1`:Promise.resolve([])]),l=o?.promotedAt?new Date(o.promotedAt):null,u=l?Math.max(0,(Date.now()-l.getTime())/864e5):0,d=i({championCalibrationError:Number(o?.calibrationError||0),championBrierScore:Number(o?.brierScore||0),currentCalibrationError:Number(s?.calibrationError||0),currentBrierScore:Number(s?.brierScore||0),ageDays:u,hasChampion:!!o?.promotedAt}),f=!1;a&&d.retire&&(await a`
   update preventive_champion_baseline_state
   set source='RETIRED_CHAMPION',promoted_at=null,rationale=${a.json(d.rationale)},updated_at=now()
   where singleton_key=1
  `,f=!0);let p=Number(c?.[0]?.retirementCount||0)+(f?1:0);return a&&(await a`
   insert into preventive_champion_baseline_health_state(
    singleton_key,status,drift_score,age_days,retired,retirement_count,last_reason,updated_at
   ) values(
    1,${d.status},${d.driftScore},${u},${f},${p},${d.rationale.join(` `)},now()
   )
   on conflict(singleton_key) do update set
    status=excluded.status,drift_score=excluded.drift_score,age_days=excluded.age_days,
    retired=excluded.retired,retirement_count=excluded.retirement_count,last_reason=excluded.last_reason,updated_at=now()
  `,await a`
   insert into preventive_champion_baseline_health_snapshots(
    model_version,status,drift_score,age_days,retired,
    champion_calibration_error,champion_brier_score,current_calibration_error,current_brier_score,rationale
   ) values(
    ${t.modelVersion},${d.status},${d.driftScore},${u},${f},
    ${Number(o?.calibrationError||0)},${Number(o?.brierScore||0)},
    ${Number(s?.calibrationError||0)},${Number(s?.brierScore||0)},
    ${a.json(d.rationale)}
   )
  `),{configured:!!a,...d,retired:f,retirementCount:p,ageDays:u}}async function o(){let t=e();if(!t)return{status:`NO_CHAMPION`,driftScore:0,ageDays:0,retired:!1,retirementCount:0,rationale:[],recent:[]};try{let[e]=await t`
   select status,drift_score::float as "driftScore",age_days::float as "ageDays",retired,
    retirement_count as "retirementCount",last_reason as "lastReason",updated_at as "updatedAt"
   from preventive_champion_baseline_health_state where singleton_key=1
  `,n=await t`
   select id,status,drift_score::float as "driftScore",age_days::float as "ageDays",retired,generated_at as "generatedAt"
   from preventive_champion_baseline_health_snapshots order by generated_at desc limit 20
  `;return{...e,rationale:e?.lastReason?[String(e.lastReason)]:[],recent:n}}catch{return{status:`NO_CHAMPION`,driftScore:0,ageDays:0,retired:!1,retirementCount:0,rationale:[],recent:[]}}}export{o as n,a as r,i as t};