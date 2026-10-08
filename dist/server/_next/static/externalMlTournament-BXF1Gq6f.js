import{t as e}from"./db-9LtqYd6N.js";import{t}from"./releaseManifest-bHjF1npa.js";import{r as n,t as r}from"./settlementLearning-BNFvsZJn.js";import{c as i,l as a,t as o}from"./trainedSportModels-DWPIV0xx.js";import{a as s,o as c,s as l,t as u}from"./mlServiceHealth-CHTaakhh.js";import{l as d}from"./mlShadowRecovery-CpgsKdSZ.js";var f=e=>e&&typeof e==`object`&&!Array.isArray(e)?e:{},p=(e,t=0,n=1)=>Math.max(t,Math.min(n,e)),m=e=>e>0?1+e/100:1+100/Math.max(1,Math.abs(e)),h=e=>p(1/m(e),.001,.999);function g(){let e=String(process.env.ML_TOURNAMENT_ALGORITHMS||``).split(`,`).map(e=>e.trim()).filter(Boolean);return e.length?e:[`logistic_l2`,`random_forest`,`hist_gradient_boosting`,`xgboost`,`lightgbm`,`catboost`,`stacking`,`pymc_bayesian_logistic`]}function _(e,t,n){let r=new Map;for(let t of e){let e=o(t.sport);if(i(e).length)for(let n of[`*`,t.marketKey]){let i=`${e}|${n}`;r.set(i,[...r.get(i)||[],t])}}return[...r.entries()].map(([e,t])=>{let[r,...i]=e.split(`|`),a=i.join(`|`),o=[...t].sort((e,t)=>new Date(e.occurredAt).getTime()-new Date(t.occurredAt).getTime());return{sport:r,marketKey:a,list:o.slice(Math.max(0,o.length-n))}}).filter(e=>e.list.length>=(e.marketKey===`*`?t:Math.max(t,120)))}async function v(t,n){let r=e();if(!r)return null;try{return(await r`
   select sport,market_key as "marketKey",algorithm,service_model_id as "serviceModelId",
    candidate_id as "candidateId",artifact_uri as "artifactUri",
    composite_score::float as "compositeScore",brier_skill_score::float as "brierSkillScore",
    holdout_brier::float as "holdoutBrier",holdout_log_loss::float as "holdoutLogLoss",
    calibration_error::float as "calibrationError",promoted_at as "promotedAt",
    model_version as "modelVersion",metadata
   from external_ml_champions
   where sport=${t} and market_key=${n} and active=true and status='ACTIVE'
   limit 1
  `)[0]||null}catch{return null}}async function y(t,n){let r=e();if(!r)return{blocked:!1,quarantined:!1,until:null,hours:0};let i=Math.max(1,Number(process.env.ML_CHAMPION_QUARANTINE_COOLDOWN_HOURS||24));try{let e=await r`
   select recorded_at as "recordedAt"
   from external_ml_champion_history
   where sport=${t} and market_key=${n} and action='QUARANTINED'
   order by recorded_at desc limit 1
  `;if(!e.length)return{blocked:!1,quarantined:!1,until:null,hours:i};let a=new Date(e[0].recordedAt).getTime()+i*36e5;return{blocked:Date.now()<a,quarantined:!0,until:new Date(a).toISOString(),hours:i}}catch{return{blocked:!1,quarantined:!1,until:null,hours:i}}}async function b(e){let n=String(process.env.ML_TRAINING_SERVICE_URL||``).trim();if(!n)return{configured:!1,ok:!1,error:`ML_TRAINING_SERVICE_URL is not configured`};if(!u())return{configured:!0,ok:!1,error:`ML service circuit breaker is open`};let r=String(process.env.ML_TRAINING_SERVICE_KEY||process.env.EXPERT_MODEL_SERVICE_KEY||``).trim(),i=new AbortController,a=Math.max(15e3,Number(process.env.ML_TRAINING_TIMEOUT_MS||9e5)),o=setTimeout(()=>i.abort(),a);try{let a=await fetch(n,{method:`POST`,headers:{"content-type":`application/json`,accept:`application/json`,...r?{authorization:`Bearer ${r}`}:{}},body:JSON.stringify({schemaVersion:`edgeforce-ml-train-v1`,modelVersion:t.modelVersion,algorithms:g(),groups:e}),cache:`no-store`,signal:i.signal}),o=await a.json().catch(()=>({}));if(!a.ok||o.ok===!1)throw Error(`training service HTTP ${a.status}: ${JSON.stringify(o.detail||o).slice(0,500)}`);return await l({serviceVersion:o.serviceVersion||null,algorithms:o.algorithmsAvailable||{}}),{configured:!0,ok:!0,body:o}}catch(e){return await c(e),{configured:!0,ok:!1,error:e instanceof Error?e.message:`training service failed`}}finally{clearTimeout(o)}}async function x(e,t){let n=String(process.env.ML_PROMOTION_SERVICE_URL||``).trim(),r=String(process.env.ML_TRAINING_SERVICE_URL||``).trim(),i=n||(r.endsWith(`/train`)?r.slice(0,-6)+`/promote`:``);if(!i)return{ok:!1,error:`ML promotion URL is not configured or derivable`};let a=String(process.env.ML_TRAINING_SERVICE_KEY||process.env.EXPERT_MODEL_SERVICE_KEY||``).trim(),o=new AbortController,s=setTimeout(()=>o.abort(),Math.max(5e3,Number(process.env.ML_PROMOTION_TIMEOUT_MS||3e4)));try{let n=await fetch(i,{method:`POST`,headers:{"content-type":`application/json`,accept:`application/json`,...a?{authorization:`Bearer ${a}`}:{}},body:JSON.stringify({schemaVersion:`edgeforce-ml-promote-v1`,sport:e.sport,marketKey:e.marketKey,serviceModelId:t.serviceModelId,algorithm:t.algorithm,artifactUri:t.artifactUri||``,compositeScore:t.compositeScore,brierSkillScore:t.brierSkillScore}),cache:`no-store`,signal:o.signal});if(!n.ok)throw Error(`promotion service HTTP ${n.status}`);return{ok:!0,body:await n.json().catch(()=>({}))}}catch(e){return{ok:!1,error:e instanceof Error?e.message:`promotion failed`}}finally{clearTimeout(s)}}function S(e,t,n){if(!e.eligible)return{promote:!1,reason:`Candidate failed service eligibility gates`};if(!t)return{promote:!0,reason:`No incumbent external ML champion`};let r=Number(t.compositeScore)||0,i=r+n;return e.compositeScore>=i?{promote:!0,reason:`Candidate composite ${e.compositeScore.toFixed(4)} cleared incumbent ${r.toFixed(4)} + margin ${n.toFixed(4)}`}:{promote:!1,reason:`Incumbent retained: candidate ${e.compositeScore.toFixed(4)} < required ${i.toFixed(4)}`}}async function C(){let o=e();if(!o)return{ok:!0,mode:`dry-run`,configured:!!process.env.ML_TRAINING_SERVICE_URL,rows:0,groups:0,candidates:0,promoted:0};if(!String(process.env.ML_TRAINING_SERVICE_URL||``).trim())return{ok:!0,mode:`unconfigured`,configured:!1,rows:0,groups:0,candidates:0,promoted:0};let c=await s();if(!c.ok)return{ok:!1,mode:`service-unhealthy`,configured:!0,rows:0,groups:0,candidates:0,promoted:0,error:c.error};let l=Math.max(1e3,Number(process.env.ML_TOURNAMENT_LOOKBACK_ROWS||3e4)),u=Math.max(80,Number(process.env.ML_TOURNAMENT_MIN_SAMPLE||120)),p=Math.max(u,Number(process.env.ML_TOURNAMENT_MAX_GROUP_ROWS||6e3)),m=Math.max(0,Number(process.env.ML_TOURNAMENT_PROMOTION_MARGIN||.01)),[C]=await o`
  insert into external_ml_tournament_runs(model_version,status,started_at,algorithms)
  values(${t.modelVersion},'running',now(),${o.json(g())})
  returning id
 `;try{let e=(await o`
   select occurred_at as "occurredAt",sport,market_key as "marketKey",
    predicted_probability::float as predicted,offered_odds as odds,outcome,features
   from historical_predictions
   where outcome is not null and model_name='Model Council'
   order by occurred_at desc
   limit ${l}
  `).map(e=>({occurredAt:new Date(e.occurredAt).toISOString(),sport:String(e.sport),marketKey:String(e.marketKey),predicted:Number(e.predicted),odds:Number(e.odds),outcome:Number(e.outcome),features:f(e.features)})),s=n(e),c=e.filter(e=>r(e.features).trainingEligible),g=_(c,u,p).map(e=>{let t=i(e.sport);return{sport:e.sport,marketKey:e.marketKey,featureNames:t,rows:e.list.map(e=>({occurredAt:e.occurredAt,features:a(e,t),outcome:e.outcome,marketProbability:h(e.odds),evidenceWeight:r(e.features).evidenceWeight}))}}),w=Math.max(1,Number(process.env.ML_TOURNAMENT_GROUPS_PER_REQUEST||2)),T=[],E=null,D={};for(let e=0;e<g.length;e+=w){let t=await b(g.slice(e,e+w));if(!t.ok)throw Error(t.error);E=t.body.serviceVersion||E,Object.assign(D,t.body.algorithmsAvailable||{}),T.push(...Array.isArray(t.body.groups)?t.body.groups:[])}let O=0,k=0,A=0,j=0,M=0;for(let e of T){let n=await v(e.sport,e.marketKey),r=n?{blocked:!1,quarantined:!1,until:null,hours:0}:await y(e.sport,e.marketKey),i=!n&&r.quarantined,a=e.champion||null,s=a?i?{promote:!1,reason:`Post-quarantine slot requires V61 multi-challenger live shadow league before external ML can return`}:S(a,n,m):{promote:!1,reason:`No eligible service winner`},c=null;a&&s.promote&&(c=await x(e,a),c.ok||(s.promote=!1));let l=new Map;for(let n of e.candidates||[]){let r=`HELD`;a&&n.serviceModelId===a.serviceModelId?r=s.promote?`CHAMPION`:i?`SHADOW_ELIGIBLE`:`CHALLENGER`:n.eligible&&(r=i?`SHADOW_ELIGIBLE`:`MONITORED`),r===`CHALLENGER`&&A++;let u=a&&n.serviceModelId===a.serviceModelId?c?.ok===!1?`Promotion failed: ${c.error}`:s.reason:n.eligible?`Eligible but not tournament winner`:`Failed service eligibility gates`,d=await o`
     insert into external_ml_candidates(
      tournament_run_id,sport,market_key,algorithm,service_model_id,role,status,
      sample_size,train_size,calibration_size,holdout_size,
      holdout_brier,holdout_log_loss,holdout_accuracy,
      market_baseline_brier,market_baseline_log_loss,brier_skill_score,
      calibration_error,composite_score,feature_names,feature_importance,
      hyperparameters,artifact_uri,training_metadata,reason,model_version,created_at
     ) values(
      ${C.id},${e.sport},${e.marketKey},${n.algorithm},${n.serviceModelId},
      ${r},'EVALUATED',${n.sampleSize},${n.trainSize},${n.calibrationSize},${n.holdoutSize},
      ${n.holdoutBrier},${n.holdoutLogLoss},${n.holdoutAccuracy},
      ${n.marketBaselineBrier},${n.marketBaselineLogLoss},${n.brierSkillScore},
      ${n.calibrationError},${n.compositeScore},${o.json(e.featureNames||[])},
      ${o.json(n.featureImportance||{})},${o.json(n.hyperparameters||{})},
      ${n.artifactUri||null},${o.json({trainingSeconds:n.trainingSeconds??null,eligible:n.eligible})},
      ${u},${t.modelVersion},now()
     ) returning id
    `;l.set(n.serviceModelId,Number(d[0]?.id||0)),O++}if(i){let t=Math.max(2,Math.min(8,Number(process.env.ML_SHADOW_LEAGUE_SIZE||4))),n=await d((e.candidates||[]).filter(e=>e.eligible).sort((e,t)=>t.compositeScore-e.compositeScore||t.brierSkillScore-e.brierSkillScore).slice(0,t).map(t=>({sport:e.sport,marketKey:e.marketKey,algorithm:t.algorithm,serviceModelId:t.serviceModelId,artifactUri:t.artifactUri||null,candidateId:l.get(t.serviceModelId)||null,tournamentRunId:Number(C.id),holdoutBrier:t.holdoutBrier,holdoutLogLoss:t.holdoutLogLoss,calibrationError:t.calibrationError,brierSkillScore:t.brierSkillScore,compositeScore:t.compositeScore})));j+=Number(n.started||0),M+=Number(n.retained||0)}if(a&&s.promote&&c?.ok){let n=l.get(a.serviceModelId)||null;await o`
     insert into external_ml_champions(
      sport,market_key,algorithm,service_model_id,candidate_id,artifact_uri,
      composite_score,brier_skill_score,holdout_brier,holdout_log_loss,calibration_error,
      promoted_at,model_version,metadata,active,status,quarantined_at,quarantine_reason
     ) values(
      ${e.sport},${e.marketKey},${a.algorithm},${a.serviceModelId},${n},
      ${a.artifactUri||null},${a.compositeScore},${a.brierSkillScore},${a.holdoutBrier},
      ${a.holdoutLogLoss},${a.calibrationError},now(),${t.modelVersion},
      ${o.json({promotionReason:s.reason,serviceVersion:E})},true,'ACTIVE',null,null
     )
     on conflict (sport,market_key) do update set
      algorithm=excluded.algorithm,service_model_id=excluded.service_model_id,candidate_id=excluded.candidate_id,
      artifact_uri=excluded.artifact_uri,composite_score=excluded.composite_score,
      brier_skill_score=excluded.brier_skill_score,holdout_brier=excluded.holdout_brier,
      holdout_log_loss=excluded.holdout_log_loss,calibration_error=excluded.calibration_error,
      promoted_at=excluded.promoted_at,model_version=excluded.model_version,metadata=excluded.metadata,
      active=true,status='ACTIVE',quarantined_at=null,quarantine_reason=null
    `,k++}}return await o`
   update external_ml_tournament_runs set completed_at=now(),status='completed',
    service_version=${E},rows_exported=${c.length},
    groups_requested=${g.length},candidates_evaluated=${O},
    champions_promoted=${k},challengers_retained=${A},
    metrics=${o.json({algorithmsAvailable:D,promotionMargin:m,minSample:u,maxRows:p,settlementLearning:s,serviceGroups:T.length,groupBatchSize:w,shadowsStarted:j,shadowsRetained:M})}
   where id=${C.id}
  `,{ok:!0,mode:`service`,configured:!0,runId:Number(C.id),serviceVersion:E,rows:c.length,rowsRead:e.length,rowsExcludedByEvidence:s.excluded,settlementLearning:s,groups:g.length,candidates:O,promoted:k,challengers:A,shadowsStarted:j,shadowsRetained:M,algorithmsAvailable:D}}catch(e){throw await o`
   update external_ml_tournament_runs set completed_at=now(),status='failed',
    error_text=${e instanceof Error?e.message:`external ML tournament failed`}
   where id=${C.id}
  `.catch(()=>void 0),e}}async function w(){let t=e();if(!t)return{ok:!0,source:`none`,latestRun:null,champions:[],candidates:[],summary:{champions:0,sports:0,candidates:0}};try{let[e]=await t`
   select id,model_version as "modelVersion",service_version as "serviceVersion",status,
    rows_exported as "rowsExported",groups_requested as "groupsRequested",
    candidates_evaluated as "candidatesEvaluated",champions_promoted as "championsPromoted",
    challengers_retained as "challengersRetained",algorithms,metrics,error_text as error,
    started_at as "startedAt",completed_at as "completedAt"
   from external_ml_tournament_runs order by started_at desc limit 1
  `,n=await t`
   select sport,market_key as "marketKey",algorithm,service_model_id as "serviceModelId",
    composite_score::float as "compositeScore",brier_skill_score::float as "brierSkillScore",
    holdout_brier::float as "holdoutBrier",holdout_log_loss::float as "holdoutLogLoss",
    calibration_error::float as "calibrationError",promoted_at as "promotedAt",
    model_version as "modelVersion",metadata
   from external_ml_champions where active=true and status='ACTIVE' order by sport,market_key
  `,r=await t`
   select tournament_run_id as "tournamentRunId",sport,market_key as "marketKey",algorithm,service_model_id as "serviceModelId",
    role,status,sample_size as "sampleSize",holdout_size as "holdoutSize",
    holdout_brier::float as "holdoutBrier",holdout_log_loss::float as "holdoutLogLoss",
    market_baseline_brier::float as "marketBaselineBrier",brier_skill_score::float as "brierSkillScore",
    calibration_error::float as "calibrationError",composite_score::float as "compositeScore",
    feature_importance as "featureImportance",reason,created_at as "createdAt"
   from external_ml_candidates
   order by created_at desc limit 500
  `;return{ok:!0,source:`database`,latestRun:e||null,champions:n,candidates:r,summary:{champions:n.length,sports:new Set(n.map(e=>e.sport)).size,candidates:r.length}}}catch(e){return{ok:!1,source:`database`,latestRun:null,champions:[],candidates:[],summary:{champions:0,sports:0,candidates:0},error:e instanceof Error?e.message:`external ML tournament status failed`}}}async function T(n){let r=e();if(!r||!n.length)return 0;let i=await r`
  select sport,market_key as "marketKey",algorithm,service_model_id as "serviceModelId"
  from external_ml_champions
  where active=true and status='ACTIVE'
 `.catch(()=>[]),a=new Map,s=new Map;for(let e of i){let t=`${String(e.sport)}|${String(e.marketKey).toLowerCase()}`;a.set(t,e),String(e.marketKey)===`*`&&s.set(String(e.sport),e)}let c=0;for(let e of n){let n=Number(e.sportFeatures?.externalExpertProbability),i=Number(e.sportFeatures?.externalExpertConfidence);if(!Number.isFinite(n)||n<=0||n>=1)continue;let l=o(e.sport||e.league),u=a.get(`${l}|${e.market.toLowerCase()}`)||s.get(l);u&&(await r`
   insert into external_ml_prediction_snapshots(
    market_id,sport,market_key,algorithm,service_model_id,probability,confidence,market_baseline_probability,observed_at,metadata
   ) values(
    ${e.id},${l},${e.market},${String(u.algorithm)},${String(u.serviceModelId)},
    ${n},${Number.isFinite(i)?i:0},${e.marketProb},now(),
    ${r.json({selection:e.selection,event:e.event,odds:e.odds,marketProbability:e.marketProb,modelVersion:t.modelVersion})}
   )
  `,c++)}return c}export{C as i,S as n,T as r,w as t};