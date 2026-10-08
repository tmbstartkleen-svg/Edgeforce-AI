import{t as e}from"./db-9LtqYd6N.js";import{t}from"./releaseManifest-bHjF1npa.js";import{t as n}from"./modelCouncil-nbPr2v_W.js";import{c as r,t as i,u as a}from"./trainedSportModels-DWPIV0xx.js";import{o,s,t as c}from"./mlServiceHealth-CHTaakhh.js";var l=(e,t=1e-4,n=.9999)=>Math.max(t,Math.min(n,e)),u=e=>e.length?e.reduce((e,t)=>e+t,0)/e.length:0;function d(e){if(!e.length)return 0;let t=new Map;for(let n of e){let e=Math.min(9,Math.floor(l(n.probability,0,.999999)*10)),r=t.get(e)||{p:[],y:[]};r.p.push(n.probability),r.y.push(n.outcome),t.set(e,r)}let n=0;for(let e of t.values())n+=Math.abs(u(e.p)-u(e.y))*e.p.length;return n/e.length}function f(e,t){let n=e.filter(e=>Number.isFinite(e.probability)&&e.probability>0&&e.probability<1&&(e.outcome===0||e.outcome===1)&&Number.isFinite(e.marketBaselineProbability)&&e.marketBaselineProbability>0&&e.marketBaselineProbability<1&&Number.isFinite(e.nativeProbability)&&e.nativeProbability>0&&e.nativeProbability<1);if(!n.length)return{sampleSize:0,liveBrier:0,liveLogLoss:0,liveCalibrationError:0,marketBrier:0,nativeBrier:0,marketBrierSkillScore:0,nativeBrierSkillScore:0,brierDegradation:0};let r=u(n.map(e=>(e.probability-e.outcome)**2)),i=u(n.map(e=>(e.marketBaselineProbability-e.outcome)**2)),a=u(n.map(e=>(e.nativeProbability-e.outcome)**2)),o=u(n.map(e=>-(e.outcome*Math.log(l(e.probability))+(1-e.outcome)*Math.log(l(1-e.probability))))),s=d(n),c=i>0?1-r/i:0,f=a>0?1-r/a:0;return{sampleSize:n.length,liveBrier:r,liveLogLoss:o,liveCalibrationError:s,marketBrier:i,nativeBrier:a,marketBrierSkillScore:c,nativeBrierSkillScore:f,brierDegradation:r-t}}function p(e){let t=e.minSample??Math.max(25,Number(process.env.ML_SHADOW_RECOVERY_MIN_SAMPLE||50));return e.sampleSize<t?{state:`INSUFFICIENT`,action:`NONE`,reason:`Need `+t+` settled shadow predictions; have `+e.sampleSize}:e.marketBrierSkillScore<=Number(process.env.ML_SHADOW_REJECT_MARKET_SKILL||-.08)&&e.nativeBrierSkillScore<=Number(process.env.ML_SHADOW_REJECT_NATIVE_SKILL||-.05)||e.liveCalibrationError>=Number(process.env.ML_SHADOW_REJECT_CALIBRATION||.18)||e.brierDegradation>=Number(process.env.ML_SHADOW_REJECT_BRIER_DEGRADATION||.08)?{state:`REJECTED`,action:`REJECT`,reason:`Shadow challenger failed live recovery guardrails`}:e.marketBrierSkillScore>=Number(process.env.ML_SHADOW_MIN_MARKET_SKILL||.02)&&e.nativeBrierSkillScore>=Number(process.env.ML_SHADOW_MIN_NATIVE_SKILL||.02)&&e.liveCalibrationError<=Number(process.env.ML_SHADOW_MAX_CALIBRATION||.1)&&e.brierDegradation<=Number(process.env.ML_SHADOW_MAX_BRIER_DEGRADATION||.04)?e.cooldownActive?{state:`COOLDOWN`,action:`NONE`,reason:`Live evidence currently passes, but the post-quarantine cooldown is still active`}:(e.priorConfirmations??0)>=1?{state:`RECOVERY_READY`,action:`PROMOTE`,reason:`Live shadow challenger beat both market and native baselines on repeated fresh evidence`}:{state:`READY_CONFIRM`,action:`NONE`,reason:`Live recovery gates passed once; one additional confirmation with new settled evidence is required`}:{state:`SHADOW`,action:`NONE`,reason:`Live evidence is not yet strong enough to restore external ML`}}function m(e){return e.marketBrierSkillScore*.45+e.nativeBrierSkillScore*.45-e.liveCalibrationError*.35-Math.max(0,e.brierDegradation)*.2}function h(e,t={}){let n=t.minCompetitors??Math.max(2,Number(process.env.ML_SHADOW_LEAGUE_MIN_COMPETITORS||2)),r=t.minSample??Math.max(25,Number(process.env.ML_SHADOW_RECOVERY_MIN_SAMPLE||50)),i=t.minMargin??Math.max(0,Number(process.env.ML_SHADOW_LEAGUE_MIN_SCORE_MARGIN||.005)),a=e.filter(e=>e.sampleSize>=r&&e.state!==`REJECTED`).sort((e,t)=>t.score-e.score||t.sampleSize-e.sampleSize||e.id-t.id);if(a.length<n)return{promote:!1,winnerId:null,runnerUpId:null,margin:null,reason:`Need `+n+` live-qualified league competitors; have `+a.length};let o=a[0],s=a[1],c=o.score-s.score;return o.recoveryAction===`PROMOTE`?c<i?{promote:!1,winnerId:o.id,runnerUpId:s.id,margin:c,reason:`Live league winner margin `+c.toFixed(4)+` is below required `+i.toFixed(4)}:{promote:!0,winnerId:o.id,runnerUpId:s.id,margin:c,reason:`Live league winner cleared recovery gates and beat runner-up by `+c.toFixed(4)}:{promote:!1,winnerId:o.id,runnerUpId:s.id,margin:c,reason:`Live league leader has not completed repeated fresh-evidence confirmation`}}function g(){let e=String(process.env.ML_SHADOW_PREDICTION_SERVICE_URL||``).trim();if(e)return e;let t=String(process.env.ML_PREDICTION_SERVICE_URL||``).trim();if(!t)return``;try{let e=new URL(t);return e.pathname=`/shadow-predict`,e.search=``,e.hash=``,e.toString()}catch{return``}}function _(){let e=String(process.env.ML_PROMOTION_SERVICE_URL||``).trim();if(e)return e;let t=String(process.env.ML_TRAINING_SERVICE_URL||``).trim();if(!t)return``;try{let e=new URL(t);return e.pathname=`/promote`,e.search=``,e.hash=``,e.toString()}catch{return``}}function v(){return String(process.env.ML_TRAINING_SERVICE_KEY||process.env.ML_PREDICTION_SERVICE_KEY||process.env.EXPERT_MODEL_SERVICE_KEY||``).trim()}function y(e){let t={...e.sportFeatures||{}};return delete t.externalExpertProbability,delete t.externalExpertConfidence,delete t.externalExpertModelCount,l(n({...e,sportFeatures:t}).ensemble,.001,.999)}async function b(t,n){let r=e(),i=Math.max(1,Number(process.env.ML_CHAMPION_QUARANTINE_COOLDOWN_HOURS||24));if(!r)return{quarantined:!1,cooldownActive:!1,cooldownUntil:null,hours:i};let a=await r`
  select recorded_at as "recordedAt"
  from external_ml_champion_history
  where sport=${t} and market_key=${n} and action='QUARANTINED'
  order by recorded_at desc limit 1
 `.catch(()=>[]);if(!a.length)return{quarantined:!1,cooldownActive:!1,cooldownUntil:null,hours:i};let o=new Date(a[0].recordedAt).getTime()+i*36e5;return{quarantined:!0,cooldownActive:Date.now()<o,cooldownUntil:new Date(o).toISOString(),hours:i}}async function x(n){let r=e();if(!r)return{ok:!0,mode:`dry-run`,leagueId:null,started:0,retained:0,active:0};if(!n.length)return{ok:!0,mode:`database`,leagueId:null,started:0,retained:0,active:0};let i=n[0],a=Math.max(2,Math.min(8,Number(process.env.ML_SHADOW_LEAGUE_SIZE||4))),o=Math.max(2,Math.min(a,Number(process.env.ML_SHADOW_LEAGUE_MIN_COMPETITORS||2))),s=await r`
  select id,max_challengers as "maxChallengers",min_competitors as "minCompetitors"
  from external_ml_shadow_leagues
  where sport=${i.sport} and market_key=${i.marketKey} and status='ACTIVE'
  order by started_at desc limit 1
 `;s.length||(s=await r`
   insert into external_ml_shadow_leagues(
    sport,market_key,status,source_tournament_run_id,max_challengers,min_competitors,
    model_version,metadata,started_at
   ) values(
    ${i.sport},${i.marketKey},'ACTIVE',${i.tournamentRunId??null},
    ${a},${o},${t.modelVersion},
    ${r.json({purpose:`V61_MULTI_CHALLENGER_LIVE_LEAGUE`,productionWeight:0})},now()
   )
   returning id,max_challengers as "maxChallengers",min_competitors as "minCompetitors"
  `);let c=Number(s[0].id),l=Number(s[0].maxChallengers||a),u=await r`
  select id,service_model_id as "serviceModelId"
  from external_ml_shadow_challengers
  where league_id=${c} and status in ('SHADOW','READY_CONFIRM')
  order by seed_rank nulls last,started_at
 `,d=new Set(u.map(e=>String(e.serviceModelId))),f=Math.max(0,l-u.length),p=0,m=u.length,h=[...n].sort((e,t)=>t.compositeScore-e.compositeScore||t.brierSkillScore-e.brierSkillScore);for(let e=0;e<h.length&&f>0;e++){let n=h[e];n.sport!==i.sport||n.marketKey!==i.marketKey||d.has(n.serviceModelId)||(await r`
   insert into external_ml_shadow_challengers(
    sport,market_key,algorithm,service_model_id,artifact_uri,candidate_id,source_tournament_run_id,
    league_id,seed_rank,status,holdout_brier,holdout_log_loss,holdout_calibration_error,
    holdout_brier_skill_score,composite_score,model_version,metadata,started_at
   ) values(
    ${n.sport},${n.marketKey},${n.algorithm},${n.serviceModelId},${n.artifactUri??null},
    ${n.candidateId??null},${n.tournamentRunId??null},${c},${u.length+p+1},'SHADOW',
    ${n.holdoutBrier},${n.holdoutLogLoss},${n.calibrationError},${n.brierSkillScore},
    ${n.compositeScore},${t.modelVersion},
    ${r.json({purpose:`V61_MULTI_CHALLENGER_LIVE_LEAGUE`,productionWeight:0})},now()
   )
   on conflict (service_model_id) do nothing
   returning id
  `).length&&(p++,f--,d.add(n.serviceModelId))}return{ok:!0,mode:`database`,leagueId:c,started:p,retained:m,active:u.length+p,maxChallengers:l,minCompetitors:o}}async function S(){let t=e();return t?await t`
  select id,sport,market_key as "marketKey",algorithm,service_model_id as "serviceModelId",
   artifact_uri as "artifactUri",candidate_id as "candidateId",source_tournament_run_id as "sourceTournamentRunId",
   league_id as "leagueId",seed_rank as "seedRank",league_rank as "leagueRank",league_score::float as "leagueScore",
   status,holdout_brier::float as "holdoutBrier",holdout_log_loss::float as "holdoutLogLoss",
   holdout_calibration_error::float as "holdoutCalibrationError",
   holdout_brier_skill_score::float as "holdoutBrierSkillScore",composite_score::float as "compositeScore",
   settled_sample_size as "settledSampleSize",confirmations,started_at as "startedAt"
  from external_ml_shadow_challengers
  where status in ('SHADOW','READY_CONFIRM')
  order by sport,market_key,started_at
 `:[]}async function C(n){let u=e();if(!u||!n.length)return{written:0,requested:0,challengers:0,mode:`dry-run`};let d=await S();if(!d.length)return{written:0,requested:0,challengers:0,mode:`database`};let f=g();if(!f)return{written:0,requested:0,challengers:d.length,mode:`unconfigured`,error:`ML shadow prediction endpoint is not configured`};if(!c())return{written:0,requested:0,challengers:d.length,mode:`circuit-open`,error:`ML service circuit is open`};let p=new Map,m=new Map;for(let e of d){let t=e.sport+`|`+e.marketKey.toLowerCase();p.set(t,[...p.get(t)||[],e]),e.marketKey===`*`&&m.set(e.sport,[...m.get(e.sport)||[],e])}let h=[];for(let e of n.slice(0,1e3)){let t=i(e.sport||e.league),n=p.get(t+`|`+e.market.toLowerCase())||m.get(t)||[];if(!n.length)continue;let o=r(t);if(!o.length)continue;let s=y(e),c=a(e,o);for(let t of n){let n=[t.id,e.id,e.market,e.selection].join(`::`);h.push({requestId:n,market:e,shadow:t,nativeProbability:s,featureNames:o,features:c})}}if(!h.length)return{written:0,requested:0,challengers:d.length,mode:`database`};let _=new AbortController,b=setTimeout(()=>_.abort(),Math.max(2500,Number(process.env.ML_SHADOW_PREDICTION_TIMEOUT_MS||12e3)));try{let e=await fetch(f,{method:`POST`,headers:{"content-type":`application/json`,accept:`application/json`,...v()?{authorization:`Bearer `+v()}:{}},body:JSON.stringify({schemaVersion:`edgeforce-ml-shadow-predict-v1`,markets:h.map(e=>({id:e.requestId,sport:i(e.market.sport||e.market.league),market:e.market.market,serviceModelId:e.shadow.serviceModelId,featureNames:e.featureNames,features:e.features}))}),cache:`no-store`,signal:_.signal}),n=await e.json().catch(()=>({}));if(!e.ok||n.ok===!1)throw Error(`shadow prediction HTTP `+e.status+`: `+JSON.stringify(n.detail||n).slice(0,400));await s({serviceVersion:n.serviceVersion||null});let r=new Map(h.map(e=>[e.requestId,e])),a=0,o=new Set;for(let e of Array.isArray(n.predictions)?n.predictions:[]){let n=r.get(String(e.marketId||``));if(!n)continue;let s=Number(e.probability);!Number.isFinite(s)||s<=0||s>=1||(await u`
    insert into external_ml_shadow_prediction_snapshots(
     challenger_id,market_id,selection_key,sport,market_key,algorithm,service_model_id,
     probability,confidence,market_baseline_probability,native_probability,observed_at,metadata
    ) values(
     ${n.shadow.id},${n.market.id},${n.market.selection},
     ${i(n.market.sport||n.market.league)},${n.market.market},
     ${n.shadow.algorithm},${n.shadow.serviceModelId},${s},
     ${Number.isFinite(Number(e.confidence))?Number(e.confidence):.6},
     ${l(n.market.marketProb,.001,.999)},${n.nativeProbability},now(),
     ${u.json({event:n.market.event,odds:n.market.odds,modelVersion:t.modelVersion,shadowOnly:!0,productionWeight:0})}
    )
    on conflict (challenger_id,market_id,market_key,selection_key) do nothing
    returning id
   `).length&&(a++,o.add(n.shadow.id))}for(let e of o)await u`update external_ml_shadow_challengers set last_prediction_at=now() where id=${e}`;return{written:a,requested:h.length,challengers:d.length,mode:`database`,warnings:n.warnings||[]}}catch(e){return await o(e),{written:0,requested:h.length,challengers:d.length,mode:`failed`,error:e instanceof Error?e.message:`shadow prediction failed`}}finally{clearTimeout(b)}}async function w(t){let n=e();if(!n)return{matched:0,settled:0,mode:`dry-run`};let r=0,i=0;for(let e of t){if(e.result===`push`)continue;let t=await n`
   update external_ml_shadow_prediction_snapshots
   set outcome=${e.result===`win`?1:0},closing_odds=${e.closingOdds??null},
       settled_at=${e.settledAt||new Date().toISOString()}
   where market_id=${e.eventId} and outcome is null
    and (${e.marketKey??null}::text is null or lower(market_key)=lower(${e.marketKey??``}))
    and lower(selection_key)=lower(${e.selectionKey})
   returning id
  `;r+=t.length,i+=t.length}return{matched:r,settled:i,mode:`database`}}async function T(t,n){let r=e();return r?await r`
  select probability::float,outcome,
   market_baseline_probability::float as "marketBaselineProbability",
   native_probability::float as "nativeProbability",settled_at as "settledAt"
  from external_ml_shadow_prediction_snapshots
  where challenger_id=${t} and outcome is not null
  order by settled_at desc
  limit ${Math.max(1,Math.min(1e3,n))}
 `:[]}async function E(t,n){let r=e();if(!r)return 0;let i=await r`
  select state,sample_size as "sampleSize"
  from ml_shadow_recovery_snapshots
  where challenger_id=${t}
  order by observed_at desc limit 3
 `,a=0,o=n;for(let e of i){let t=Number(e.sampleSize||0);if(String(e.state)!==`READY_CONFIRM`||t>=o)break;a++,o=t}return a}async function D(t,n){let r=e();return r?(await r`
  select 1 from external_ml_champions
  where sport=${t} and market_key=${n} and active=true and status='ACTIVE'
  limit 1
 `).length>0:!1}async function O(e,t){let n=_();if(!n)return{ok:!1,error:`ML promotion endpoint is not configured`};if(await D(e.sport,e.marketKey))return{ok:!1,error:`An active external champion already occupies this slot`};let r=new AbortController,i=setTimeout(()=>r.abort(),Math.max(3e3,Number(process.env.ML_PROMOTION_TIMEOUT_MS||3e4)));try{let t=await fetch(n,{method:`POST`,headers:{"content-type":`application/json`,accept:`application/json`,...v()?{authorization:`Bearer `+v()}:{}},body:JSON.stringify({schemaVersion:`edgeforce-ml-promote-v1`,sport:e.sport,marketKey:e.marketKey,serviceModelId:e.serviceModelId,algorithm:e.algorithm,artifactUri:e.artifactUri||``,compositeScore:e.compositeScore,brierSkillScore:e.holdoutBrierSkillScore}),cache:`no-store`,signal:r.signal}),i=await t.json().catch(()=>({}));if(!t.ok||i.ok!==!0)throw Error(i.detail||`ML promotion HTTP `+t.status);return{ok:!0,body:i}}catch(e){return{ok:!1,error:e instanceof Error?e.message:`shadow promotion failed`}}finally{clearTimeout(i)}}async function k(){let n=e();if(!n)return{ok:!0,mode:`dry-run`,leagues:0,challengers:0,insufficient:0,shadow:0,readyConfirm:0,recovered:0,rejected:0,promotionFailed:0,leagueWinnersReady:0,rows:[]};let[r]=await n`
  insert into ml_shadow_recovery_runs(model_version,status,started_at)
  values(${t.modelVersion},'running',now())
  returning id
 `,i=Math.max(25,Number(process.env.ML_SHADOW_RECOVERY_WINDOW||150)),a=Math.max(25,Number(process.env.ML_SHADOW_RECOVERY_MIN_SAMPLE||50)),o=Math.max(0,Number(process.env.ML_SHADOW_LEAGUE_MIN_SCORE_MARGIN||.005)),s=0,c=0,l=0,u=0,d=0,g=0,_=0,v=[];try{let e=await S(),y=new Map;for(let t of e){let e=t.leagueId?String(t.leagueId):t.sport+`|`+t.marketKey;y.set(e,[...y.get(e)||[],t])}for(let e of y.values()){let y=e[0],x=Math.max(2,Number(process.env.ML_SHADOW_LEAGUE_MIN_COMPETITORS||2));if(y.leagueId){let e=await n`
     select min_competitors as "minCompetitors"
     from external_ml_shadow_leagues where id=${y.leagueId} limit 1
    `;e.length&&(x=Math.max(2,Number(e[0].minCompetitors||x)))}let S=[];for(let t of e){let e=f(await T(t.id,i),t.holdoutBrier),n=await E(t.id,e.sampleSize),r=await b(t.sport,t.marketKey),o=p({...e,priorConfirmations:n,cooldownActive:r.cooldownActive,minSample:a});S.push({challenger:t,...e,confirmations:n,quarantine:r,baseDecision:o,score:m(e),rank:0,state:o.state,action:o.action,reason:o.reason,winnerMargin:null})}let C=[...S].filter(e=>e.baseDecision.state!==`REJECTED`).sort((e,t)=>t.score-e.score||t.sampleSize-e.sampleSize||e.challenger.id-t.challenger.id);C.forEach((e,t)=>{e.rank=t+1});let w=h(S.map(e=>({id:e.challenger.id,sampleSize:e.sampleSize,score:e.score,recoveryAction:e.baseDecision.action,state:e.baseDecision.state})),{minCompetitors:x,minSample:a,minMargin:o}),D=S.find(e=>e.challenger.id===w.winnerId)||C[0]||null,k=C.filter(e=>e.sampleSize>=a).length;D&&k>=x&&(D.baseDecision.state===`READY_CONFIRM`||D.baseDecision.action===`PROMOTE`)&&_++;let A=S.find(e=>e.challenger.id===w.runnerUpId)||C[1]||null,j=w.margin;for(let e of S)e.winnerMargin=j,e.baseDecision.state===`REJECTED`?(e.state=`REJECTED`,e.action=`REJECT`):!D||e.challenger.id!==D.challenger.id?(e.state=e.sampleSize<a?`INSUFFICIENT`:`LEAGUE_HELD`,e.action=`NONE`,e.reason=e.sampleSize<a?e.baseDecision.reason:`Live-qualified challenger currently ranks #`+(e.rank||`—`)+` behind the league leader`):C.filter(e=>e.sampleSize>=a).length<x?(e.state=`LEAGUE_WAIT`,e.action=`NONE`,e.reason=w.reason):e.baseDecision.state===`COOLDOWN`?(e.state=`COOLDOWN`,e.action=`NONE`,e.reason=e.baseDecision.reason):e.baseDecision.state===`READY_CONFIRM`?(e.state=`READY_CONFIRM`,e.action=`NONE`,e.reason=`Live league leader passed recovery gates; fresh confirmation required while retaining league lead`):e.baseDecision.action===`PROMOTE`&&!w.promote&&(e.state=`LEAGUE_HELD`,e.action=`NONE`,e.reason=w.reason);if(w.promote&&D){D.reason=w.reason;let e=await O(D.challenger,D.reason);if(e.ok){await n`
      insert into external_ml_champions(
       sport,market_key,algorithm,service_model_id,candidate_id,artifact_uri,
       composite_score,brier_skill_score,holdout_brier,holdout_log_loss,calibration_error,
       promoted_at,model_version,metadata,active,status,quarantined_at,quarantine_reason,
       last_monitor_at,live_sample_size,live_brier,live_log_loss,live_calibration_error,
       live_brier_skill_score,live_drift_score
      ) values(
       ${D.challenger.sport},${D.challenger.marketKey},${D.challenger.algorithm},${D.challenger.serviceModelId},
       ${D.challenger.candidateId??null},${D.challenger.artifactUri??null},${D.challenger.compositeScore},
       ${D.challenger.holdoutBrierSkillScore},${D.challenger.holdoutBrier},${D.challenger.holdoutLogLoss},
       ${D.challenger.holdoutCalibrationError},now(),${t.modelVersion},
       ${n.json({promotionReason:D.reason,recovery:`V61_MULTI_CHALLENGER_SHADOW_LEAGUE`,shadowSampleSize:D.sampleSize,nativeBrierSkillScore:D.nativeBrierSkillScore,marketBrierSkillScore:D.marketBrierSkillScore,leagueRank:1,winnerMargin:j,runnerUpServiceModelId:A?.challenger.serviceModelId||null})},
       true,'ACTIVE',null,null,now(),${D.sampleSize},${D.liveBrier},${D.liveLogLoss},
       ${D.liveCalibrationError},${D.marketBrierSkillScore},0
      )
      on conflict (sport,market_key) do update set
       algorithm=excluded.algorithm,service_model_id=excluded.service_model_id,candidate_id=excluded.candidate_id,
       artifact_uri=excluded.artifact_uri,composite_score=excluded.composite_score,
       brier_skill_score=excluded.brier_skill_score,holdout_brier=excluded.holdout_brier,
       holdout_log_loss=excluded.holdout_log_loss,calibration_error=excluded.calibration_error,
       promoted_at=excluded.promoted_at,model_version=excluded.model_version,metadata=excluded.metadata,
       active=true,status='ACTIVE',quarantined_at=null,quarantine_reason=null,last_monitor_at=excluded.last_monitor_at,
       live_sample_size=excluded.live_sample_size,live_brier=excluded.live_brier,live_log_loss=excluded.live_log_loss,
       live_calibration_error=excluded.live_calibration_error,live_brier_skill_score=excluded.live_brier_skill_score,
       live_drift_score=excluded.live_drift_score
     `,D.state=`RECOVERED`,D.action=`PROMOTED`;for(let e of S)e.challenger.id!==D.challenger.id&&e.baseDecision.state!==`REJECTED`&&(e.state=`LEAGUE_LOST`,e.action=`LOST`,e.reason=`Live league completed; `+D.challenger.algorithm+` won production recovery`);y.leagueId&&await n`
       update external_ml_shadow_leagues set status='RECOVERED',
        winner_challenger_id=${D.challenger.id},winner_service_model_id=${D.challenger.serviceModelId},
        winner_margin=${j},decision_reason=${D.reason},completed_at=now()
       where id=${y.leagueId}
      `,await n`
      insert into external_ml_champion_history(
       tournament_run_id,sport,market_key,algorithm,service_model_id,action,composite_score,brier_skill_score,
       holdout_brier,holdout_log_loss,calibration_error,reason,model_version,metadata,recorded_at
      ) values(
       ${D.challenger.sourceTournamentRunId??null},${D.challenger.sport},${D.challenger.marketKey},
       ${D.challenger.algorithm},${D.challenger.serviceModelId},'RECOVERED',${D.challenger.compositeScore},
       ${D.challenger.holdoutBrierSkillScore},${D.challenger.holdoutBrier},${D.challenger.holdoutLogLoss},
       ${D.challenger.holdoutCalibrationError},${D.reason},${t.modelVersion},
       ${n.json({shadowSampleSize:D.sampleSize,marketBrierSkillScore:D.marketBrierSkillScore,nativeBrierSkillScore:D.nativeBrierSkillScore,liveCalibrationError:D.liveCalibrationError,leagueId:y.leagueId||null,leagueSize:S.length,winnerMargin:j,runnerUpServiceModelId:A?.challenger.serviceModelId||null})},now()
      )
     `,u++}else g++,D.state=`READY_CONFIRM`,D.action=`PROMOTION_FAILED`,D.reason+=`; `+e.error}for(let e of S){e.state===`INSUFFICIENT`?s++:e.state===`READY_CONFIRM`?l++:e.state===`REJECTED`?d++:e.state!==`RECOVERED`&&e.state!==`LEAGUE_LOST`&&c++;let t=e.state===`RECOVERED`?`RECOVERED`:e.state===`REJECTED`?`REJECTED`:e.state===`LEAGUE_LOST`?`LOST`:e.state===`READY_CONFIRM`?`READY_CONFIRM`:`SHADOW`,i=[`RECOVERED`,`REJECTED`,`LOST`].includes(t),a=e.state===`READY_CONFIRM`?e.confirmations+1:e.confirmations;await n`
     update external_ml_shadow_challengers set status=${t},
      recovery_eligible=${e.state===`READY_CONFIRM`||e.state===`RECOVERED`},
      decision_reason=${e.reason},last_evaluated_at=now(),
      completed_at=${i?new Date().toISOString():null},
      settled_sample_size=${e.sampleSize},live_brier=${e.liveBrier},
      live_log_loss=${e.liveLogLoss},live_calibration_error=${e.liveCalibrationError},
      market_brier=${e.marketBrier},native_brier=${e.nativeBrier},
      market_brier_skill_score=${e.marketBrierSkillScore},native_brier_skill_score=${e.nativeBrierSkillScore},
      brier_degradation=${e.brierDegradation},confirmations=${a},
      league_rank=${e.rank||null},league_score=${e.score},winner_margin=${e.winnerMargin}
     where id=${e.challenger.id}
    `,await n`
     insert into ml_shadow_recovery_snapshots(
      recovery_run_id,challenger_id,league_id,sport,market_key,algorithm,service_model_id,state,sample_size,
      live_brier,live_log_loss,live_calibration_error,market_brier,native_brier,
      market_brier_skill_score,native_brier_skill_score,brier_degradation,prior_confirmations,
      league_rank,league_score,winner_margin,action,reason,metrics,observed_at
     ) values(
      ${r.id},${e.challenger.id},${e.challenger.leagueId??null},${e.challenger.sport},${e.challenger.marketKey},
      ${e.challenger.algorithm},${e.challenger.serviceModelId},${e.state},${e.sampleSize},
      ${e.liveBrier},${e.liveLogLoss},${e.liveCalibrationError},${e.marketBrier},${e.nativeBrier},
      ${e.marketBrierSkillScore},${e.nativeBrierSkillScore},${e.brierDegradation},${e.confirmations},
      ${e.rank||null},${e.score},${e.winnerMargin},${e.action},${e.reason},
      ${n.json({cooldownActive:e.quarantine.cooldownActive,cooldownUntil:e.quarantine.cooldownUntil,holdoutBrier:e.challenger.holdoutBrier,leagueDecision:w.reason,minCompetitors:x,minScoreMargin:o})},now()
     )
    `,v.push({...e,leagueDecision:w})}}return await n`
   update ml_shadow_recovery_runs set status='completed',completed_at=now(),
    challengers_checked=${v.length},leagues_checked=${y.size},insufficient=${s},
    shadow=${c},ready_confirm=${l},recovered=${u},rejected=${d},
    promotion_failed=${g},league_winners_ready=${_}
   where id=${r.id}
  `,{ok:!0,mode:`database`,runId:Number(r.id),leagues:y.size,challengers:v.length,insufficient:s,shadow:c,readyConfirm:l,recovered:u,rejected:d,promotionFailed:g,leagueWinnersReady:_,rows:v}}catch(e){throw await n`
   update ml_shadow_recovery_runs set status='failed',completed_at=now(),
    error_text=${e instanceof Error?e.message:`shadow recovery failed`}
   where id=${r.id}
  `.catch(()=>void 0),e}}async function A(){let t=e();if(!t)return{ok:!0,source:`none`,latestRun:null,leagues:[],challengers:[],recent:[]};try{let[e]=await t`
   select id,model_version as "modelVersion",status,challengers_checked as "challengersChecked",
    leagues_checked as "leaguesChecked",league_winners_ready as "leagueWinnersReady",
    insufficient,shadow,ready_confirm as "readyConfirm",recovered,rejected,
    promotion_failed as "promotionFailed",error_text as error,
    started_at as "startedAt",completed_at as "completedAt"
   from ml_shadow_recovery_runs order by started_at desc limit 1
  `,n=await t`
   select id,league_id as "leagueId",seed_rank as "seedRank",league_rank as "leagueRank",
    league_score::float as "leagueScore",winner_margin::float as "winnerMargin",
    sport,market_key as "marketKey",algorithm,service_model_id as "serviceModelId",status,
    holdout_brier::float as "holdoutBrier",holdout_brier_skill_score::float as "holdoutBrierSkillScore",
    settled_sample_size as "settledSampleSize",live_brier::float as "liveBrier",
    live_log_loss::float as "liveLogLoss",live_calibration_error::float as "liveCalibrationError",
    market_brier::float as "marketBrier",native_brier::float as "nativeBrier",
    market_brier_skill_score::float as "marketBrierSkillScore",
    native_brier_skill_score::float as "nativeBrierSkillScore",brier_degradation::float as "brierDegradation",
    confirmations,recovery_eligible as "recoveryEligible",decision_reason as "decisionReason",
    started_at as "startedAt",last_prediction_at as "lastPredictionAt",
    last_evaluated_at as "lastEvaluatedAt",completed_at as "completedAt"
   from external_ml_shadow_challengers
   order by case when status in ('SHADOW','READY_CONFIRM') then 0 else 1 end,started_at desc
   limit 250
  `,r=await t`
   select id,sport,market_key as "marketKey",status,source_tournament_run_id as "sourceTournamentRunId",
    max_challengers as "maxChallengers",min_competitors as "minCompetitors",
    winner_challenger_id as "winnerChallengerId",winner_service_model_id as "winnerServiceModelId",
    winner_margin::float as "winnerMargin",decision_reason as "decisionReason",
    started_at as "startedAt",completed_at as "completedAt"
   from external_ml_shadow_leagues
   order by case when status='ACTIVE' then 0 else 1 end,started_at desc
   limit 100
  `,i=await t`
   select challenger_id as "challengerId",league_id as "leagueId",league_rank as "leagueRank",
    league_score::float as "leagueScore",winner_margin::float as "winnerMargin",
    sport,market_key as "marketKey",algorithm,
    service_model_id as "serviceModelId",state,sample_size as "sampleSize",
    live_brier::float as "liveBrier",live_log_loss::float as "liveLogLoss",
    live_calibration_error::float as "liveCalibrationError",market_brier::float as "marketBrier",
    native_brier::float as "nativeBrier",market_brier_skill_score::float as "marketBrierSkillScore",
    native_brier_skill_score::float as "nativeBrierSkillScore",brier_degradation::float as "brierDegradation",
    prior_confirmations as "priorConfirmations",action,reason,metrics,observed_at as "observedAt"
   from ml_shadow_recovery_snapshots
   order by observed_at desc limit 500
  `;return{ok:!0,source:`database`,latestRun:e||null,leagues:r,challengers:n,recent:i}}catch(e){return{ok:!1,source:`database`,latestRun:null,leagues:[],challengers:[],recent:[],error:e instanceof Error?e.message:`shadow recovery status failed`}}}export{h as a,A as c,m as i,x as l,k as n,p as o,w as r,f as s,C as t};