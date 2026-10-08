import{t as e}from"./db-9LtqYd6N.js";import{t}from"./releaseManifest-bHjF1npa.js";import{t as n}from"./externalMlTournament-BXF1Gq6f.js";import{t as r}from"./mlActivation-DhDhzG4t.js";var i=e=>`${e.sport}|${e.marketKey}`,a=(e,t)=>t>0?(t-e)/t:0;function o(e){let t=new Map;for(let n of e){let e=i(n);t.set(e,[...t.get(e)||[],n])}return[...t.entries()].map(([e,t])=>{let n=[...t].sort((e,t)=>t.compositeScore-e.compositeScore||t.brierSkillScore-e.brierSkillScore||e.holdoutBrier-t.holdoutBrier),r=n[0]||null,i=n[1]||null;return{group:e,sport:r?.sport||e.split(`|`)[0],marketKey:r?.marketKey||e.split(`|`).slice(1).join(`|`),winner:r,runnerUp:i,margin:i&&r?r.compositeScore-i.compositeScore:null,marketBrierImprovement:r?a(r.holdoutBrier,r.marketBaselineBrier):0,eligibleCount:n.filter(e=>e.role===`CHAMPION`||e.role===`CHALLENGER`||e.role===`MONITORED`).length,candidates:n.slice(0,5)}}).sort((e,t)=>(t.winner?.brierSkillScore||0)-(e.winner?.brierSkillScore||0)||(t.winner?.compositeScore||0)-(e.winner?.compositeScore||0))}function s(e,t){let n=new Map(e.map(e=>[i(e),e]));return t.map(e=>{let t=n.get(i(e)),r=!t||t.serviceModelId!==e.serviceModelId;return{...e,action:t?r?`REPLACED`:`RETAINED`:`PROMOTED`,priorAlgorithm:t?.algorithm||null,priorServiceModelId:t?.serviceModelId||null,scoreDelta:t?e.compositeScore-t.compositeScore:null}})}function c(){let e=String(process.env.ML_SERVICE_BASE_URL||``).trim().replace(/\/$/,``);if(e)return e;for(let e of[process.env.ML_PREDICTION_SERVICE_URL,process.env.ML_TRAINING_SERVICE_URL]){let t=String(e||``).trim();if(t)try{let e=new URL(t);return e.pathname=``,e.search=``,e.hash=``,e.toString().replace(/\/$/,``)}catch{}}return``}async function l(e){let t=c();if(!t)return{ok:!1,configured:!1,verified:0,missing:e.length,serviceVersion:null,rows:[],error:`ML service base URL unavailable`};let n=String(process.env.ML_PREDICTION_SERVICE_KEY||process.env.ML_TRAINING_SERVICE_KEY||process.env.EXPERT_MODEL_SERVICE_KEY||``).trim(),r=new AbortController,i=setTimeout(()=>r.abort(),Math.max(2e3,Number(process.env.ML_CHAMPION_VERIFY_TIMEOUT_MS||1e4)));try{let i=await fetch(t+`/champions`,{headers:{accept:`application/json`,...n?{authorization:`Bearer ${n}`}:{}},cache:`no-store`,signal:r.signal}),a=await i.json().catch(()=>({}));if(!i.ok||a.ok!==!0||a.schemaVersion!==`edgeforce-ml-champions-v1`)throw Error(`champion artifact HTTP ${i.status}`);let o=new Map((a.champions||[]).map(e=>[String(e.serviceModelId||``),e])),s=e.map(e=>{let t=o.get(e.serviceModelId),n=!!t?.artifactExists&&Number(t?.artifactBytes||0)>0;return{sport:e.sport,marketKey:e.marketKey,algorithm:e.algorithm,serviceModelId:e.serviceModelId,artifactExists:n,artifactBytes:Number(t?.artifactBytes||0)}}),c=s.filter(e=>e.artifactExists).length;return{ok:c===e.length,configured:!0,verified:c,missing:e.length-c,serviceVersion:a.serviceVersion||null,rows:s,error:c===e.length?null:`One or more promoted champions are missing persisted service artifacts`}}catch(t){return{ok:!1,configured:!0,verified:0,missing:e.length,serviceVersion:null,rows:[],error:t instanceof Error?t.message:`champion artifact verification failed`}}finally{clearTimeout(i)}}function u(e){if(![`ACTIVE`,`READY_AWAITING_EVIDENCE`].includes(e.activationState))return{grade:`BLOCKED`,launchReady:!1,reason:`Activation state ${e.activationState} is not launch-safe`};if(e.candidates<1)return{grade:`NO_EVIDENCE`,launchReady:!1,reason:`No heavyweight ML candidates were evaluated`};if(e.champions<1)return{grade:`AWAITING_CHAMPION`,launchReady:!1,reason:`Tournament completed but no candidate cleared promotion gates`};if(e.artifactsMissing>0||e.artifactsVerified<e.champions)return{grade:`ARTIFACT_MISMATCH`,launchReady:!1,reason:`A promoted database champion is missing from persistent hosted model storage`};let t=Math.max(1,Number(process.env.ML_FIRST_TOURNAMENT_MIN_SPORTS||1));return e.sports<t?{grade:`LIMITED_COVERAGE`,launchReady:!0,reason:`${e.sports} sport(s) have champions; minimum preferred coverage is ${t}`}:{grade:`VERIFIED`,launchReady:!0,reason:`Tournament produced persisted, hosted champions with auditable holdout evidence`}}async function d(){let i=e(),a=await n(),c=new Date,d=null;if(i){let e=await i`
   insert into ml_first_tournament_runs(model_version,status,champions_before,started_at)
   values(${t.modelVersion},'running',${a.summary?.champions||0},now())
   returning id
  `;d=Number(e[0]?.id||0)||null}try{let e=await r({runTournament:!0}),f=await n(),p=Number(e.tournament?.runId||f.latestRun?.id||0)||null,m=f.candidates.filter(e=>!p||Number(e.tournamentRunId)===p),h=o(m),g=f.champions,_=s(a.champions,g),v=await l(g),y=new Set(g.map(e=>e.sport)).size,b=u({activationState:e.readiness.state,candidates:m.length,champions:g.length,sports:y,artifactsVerified:v.verified,artifactsMissing:v.missing});if(i){for(let e of _)await i`
     insert into external_ml_champion_history(
      tournament_run_id,sport,market_key,algorithm,service_model_id,action,
      composite_score,brier_skill_score,holdout_brier,holdout_log_loss,calibration_error,
      reason,model_version,metadata,recorded_at
     ) values(
      ${p},${e.sport},${e.marketKey},${e.algorithm},${e.serviceModelId},${e.action},
      ${e.compositeScore},${e.brierSkillScore},${e.holdoutBrier},${e.holdoutLogLoss},${e.calibrationError},
      ${String(e.metadata?.promotionReason||b.reason)},${t.modelVersion},
      ${i.json({priorAlgorithm:e.priorAlgorithm,priorServiceModelId:e.priorServiceModelId,scoreDelta:e.scoreDelta})},now()
     )
    `;d&&await i`
     update ml_first_tournament_runs set
      status=${b.launchReady?`completed`:`held`},tournament_run_id=${p},
      activation_state=${e.readiness.state},service_version=${v.serviceVersion||e.health.serviceVersion||null},
      candidates_evaluated=${m.length},champions_after=${g.length},
      champion_changes=${_.filter(e=>e.action!==`RETAINED`).length},sports_covered=${y},
      artifacts_verified=${v.verified},artifacts_missing=${v.missing},
      leaderboard=${i.json(h)},coverage=${i.json({evidence:b,sports:y,groups:h.length})},
      artifact_verification=${i.json(v)},completed_at=now()
     where id=${d}
    `}return{ok:!0,build:`V61`,schemaVersion:`v61-first-champion-tournament-1`,runId:d,startedAt:c.toISOString(),tournamentRunId:p,activation:e.readiness,evidence:b,leaderboard:h,champions:g,changes:_,artifacts:v,summary:{candidates:m.length,groups:h.length,champions:g.length,sports:y,championChanges:_.filter(e=>e.action!==`RETAINED`).length,artifactsVerified:v.verified,artifactsMissing:v.missing}}}catch(e){throw i&&d&&await i`
    update ml_first_tournament_runs set status='failed',completed_at=now(),
     error_text=${e instanceof Error?e.message:`first champion tournament failed`}
    where id=${d}
   `.catch(()=>void 0),e}}async function f(){let t=e(),r=await n();if(!t)return{ok:!0,build:`V61`,schemaVersion:`v61-first-champion-tournament-1`,latest:null,championHistory:[],tournament:r};try{let[e]=await t`
   select id,model_version as "modelVersion",status,tournament_run_id as "tournamentRunId",
    activation_state as "activationState",service_version as "serviceVersion",
    candidates_evaluated as "candidatesEvaluated",champions_before as "championsBefore",
    champions_after as "championsAfter",champion_changes as "championChanges",
    sports_covered as "sportsCovered",artifacts_verified as "artifactsVerified",
    artifacts_missing as "artifactsMissing",leaderboard,coverage,
    artifact_verification as "artifactVerification",error_text as error,
    started_at as "startedAt",completed_at as "completedAt"
   from ml_first_tournament_runs order by started_at desc limit 1
  `,n=await t`
   select tournament_run_id as "tournamentRunId",sport,market_key as "marketKey",
    algorithm,service_model_id as "serviceModelId",action,
    composite_score::float as "compositeScore",brier_skill_score::float as "brierSkillScore",
    holdout_brier::float as "holdoutBrier",holdout_log_loss::float as "holdoutLogLoss",
    calibration_error::float as "calibrationError",reason,model_version as "modelVersion",
    metadata,recorded_at as "recordedAt"
   from external_ml_champion_history order by recorded_at desc limit 500
  `;return{ok:!0,build:`V61`,schemaVersion:`v61-first-champion-tournament-1`,latest:e||null,championHistory:n,tournament:r}}catch(e){return{ok:!1,build:`V61`,schemaVersion:`v61-first-champion-tournament-1`,latest:null,championHistory:[],tournament:r,error:e instanceof Error?e.message:`first champion tournament status failed`}}}export{d as a,u as i,s as n,f as r,o as t};