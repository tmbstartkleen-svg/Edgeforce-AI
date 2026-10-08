import{t as e}from"./db-9LtqYd6N.js";import{t}from"./releaseManifest-bHjF1npa.js";import{r as n,t as r}from"./settlementLearning-BNFvsZJn.js";import{t as i}from"./backtest-C3tJhQT8.js";import{n as a}from"./modelCalibration-BEmX_mN5.js";import{t as o}from"./modelPerformance-MBoIKhzt.js";var s=(e,t=0,n=1)=>Math.max(t,Math.min(n,e)),c=(e,t,n)=>[e,t,n].join(`|`),l=(e,t)=>[e,t].join(`|`);function u(){return{minBaseline:Math.max(20,Number(process.env.MODEL_GOVERNANCE_MIN_BASELINE||40)),minRecent:Math.max(10,Number(process.env.MODEL_GOVERNANCE_MIN_RECENT||20)),recentFraction:s(Number(process.env.MODEL_GOVERNANCE_RECENT_FRACTION||.3),.15,.5),promotionMargin:s(Number(process.env.MODEL_GOVERNANCE_PROMOTION_MARGIN||.015),0,.08),lookbackRows:Math.max(1e3,Number(process.env.MODEL_GOVERNANCE_LOOKBACK_ROWS||3e4))}}function d(e){return e.length?e.reduce((e,t)=>e+t,0)/e.length:0}function f(e,t=10){let n=Array.from({length:t},()=>0);for(let r of e){let e=s(Number(r),0,.999999);n[Math.min(t-1,Math.floor(e*t))]++}let r=Math.max(1,e.length);return n.map(e=>Math.max(1e-4,e/r))}function p(e,t,n=10){if(!e.length||!t.length)return 0;let r=f(e,n),i=f(t,n);return r.reduce((e,t,n)=>e+(i[n]-t)*Math.log(i[n]/t),0)}function m(e,t,n,r){return e>=.3||t>=.08||n>=.18||r>=.08?`CRITICAL`:e>=.18||t>=.045||n>=.1||r>=.045?`DRIFTING`:e>=.1||t>=.02||n>=.05||r>=.025?`WATCH`:`HEALTHY`}function h(e){return e===`WATCH`?.92:e===`DRIFTING`?.72:e===`CRITICAL`?.45:1}function g(e){let t=i(e),n=a(e),r=o(e)[0],c=s(1-t.brierScore/.35),l=s(1-t.logLoss/.9),u=s(1-n.meanAbsoluteCalibrationError/.15),d=s(r?.decayedScore??0),f=s(.5+t.avgClv*5);return{score:c*.32+l*.18+u*.18+d*.22+f*.1,summary:t,calibration:n,decayedScore:d}}function _(e,t){let n=[...e].sort((e,t)=>new Date(e.occurredAt).getTime()-new Date(t.occurredAt).getTime());if(n.length<t.minBaseline+t.minRecent)return{baseline:n,recent:[]};let r=Math.max(t.minRecent,Math.floor(n.length*t.recentFraction)),i=Math.min(n.length-t.minBaseline,r);return{baseline:n.slice(0,n.length-i),recent:n.slice(n.length-i)}}function v(e,t){let n=new Map;for(let t of e){let e=c(t.modelName,t.sport,t.marketKey);n.set(e,[...n.get(e)||[],t])}let r=[];for(let[e,o]of n){let[n,s,c]=e.split(`|`),{baseline:l,recent:u}=_(o,t);if(u.length<t.minRecent||l.length<t.minBaseline){r.push({modelName:n,sport:s,marketKey:c,role:`MONITORED`,driftStatus:`INSUFFICIENT`,baselineSampleSize:l.length,recentSampleSize:u.length,psi:0,meanProbabilityShift:0,brierDelta:0,logLossDelta:0,calibrationDelta:0,avgClvDelta:0,recentBrierScore:0,recentLogLoss:0,recentCalibrationError:0,recentDecayedScore:0,score:0,effectiveScore:0,weightBrake:1,runtimeMultiplier:1,reason:`Insufficient history: baseline ${l.length}/${t.minBaseline}, recent ${u.length}/${t.minRecent}`});continue}let f=i(l),v=a(l),y=g(u),b=p(l.map(e=>e.predicted),u.map(e=>e.predicted)),x=y.summary.brierScore-f.brierScore,S=y.summary.logLoss-f.logLoss,C=y.calibration.meanAbsoluteCalibrationError-v.meanAbsoluteCalibrationError,w=y.summary.avgClv-f.avgClv,T=d(u.map(e=>e.predicted))-d(l.map(e=>e.predicted)),E=m(b,x,S,C),D=h(E),O=y.score*D;r.push({modelName:n,sport:s,marketKey:c,role:`MONITORED`,driftStatus:E,baselineSampleSize:l.length,recentSampleSize:u.length,psi:b,meanProbabilityShift:T,brierDelta:x,logLossDelta:S,calibrationDelta:C,avgClvDelta:w,recentBrierScore:y.summary.brierScore,recentLogLoss:y.summary.logLoss,recentCalibrationError:y.calibration.meanAbsoluteCalibrationError,recentDecayedScore:y.decayedScore,score:y.score,effectiveScore:O,weightBrake:D,runtimeMultiplier:D,reason:`${E}: PSI ${b.toFixed(3)}, Brier Δ ${x.toFixed(3)}, log-loss Δ ${S.toFixed(3)}, calibration Δ ${C.toFixed(3)}`})}return r}function y(e,t=u(),n={}){let r=v(e,t),i=new Map;for(let e of r)i.set(l(e.sport,e.marketKey),[...i.get(l(e.sport,e.marketKey))||[],e]);for(let[e,r]of i){let i=r.filter(e=>e.driftStatus!==`CRITICAL`&&e.driftStatus!==`INSUFFICIENT`).sort((e,t)=>t.effectiveScore-e.effectiveScore||t.recentSampleSize-e.recentSampleSize),a=i[0],o=n[e],c=o?i.find(e=>e.modelName===o):void 0;c&&a&&a.modelName!==c.modelName&&a.effectiveScore<c.effectiveScore+t.promotionMargin&&(a=c);let l=i.find(e=>e.modelName!==a?.modelName);for(let e of r){e.driftStatus===`CRITICAL`?e.role=`HELD`:e.modelName===a?.modelName?e.role=`CHAMPION`:e.modelName===l?.modelName?e.role=`CHALLENGER`:e.role=`MONITORED`;let t=e.role===`CHAMPION`?1.04:e.role===`CHALLENGER`?1:e.role===`MONITORED`?.96:.75;e.runtimeMultiplier=e.driftStatus===`INSUFFICIENT`?1:s(e.weightBrake*t,.35,1.05),e.reason+=`; role ${e.role}, runtime ×${e.runtimeMultiplier.toFixed(3)}`}}return r.sort((e,t)=>{let n=l(e.sport,e.marketKey).localeCompare(l(t.sport,t.marketKey));if(n)return n;let r=e=>e===`CHAMPION`?0:e===`CHALLENGER`?1:e===`MONITORED`?2:3;return r(e.role)-r(t.role)||t.effectiveScore-e.effectiveScore})}async function b(){let t=e();if(!t)return{};try{let e=await t`
   select distinct on (sport,market_key)
    sport,market_key as "marketKey",model_name as "modelName"
   from model_governance_snapshots
   where role='CHAMPION'
   order by sport,market_key,as_of desc
  `;return Object.fromEntries(e.map(e=>[l(String(e.sport),String(e.marketKey)),String(e.modelName)]))}catch{return{}}}async function x(i=u()){let a=e();if(!a)return{ok:!0,mode:`dry-run`,rows:0,profiles:[],summary:{champions:0,challengers:0,watch:0,drifting:0,critical:0},options:i};let[o]=await a`
  insert into model_governance_runs(model_version,status,started_at)
  values(${t.modelVersion},'running',now())
  returning id
 `;try{let e=await a`
   select occurred_at as "occurredAt",sport,market_key as "marketKey",model_name as "modelName",
    predicted_probability::float as predicted,offered_odds as odds,closing_odds as "closingOdds",outcome,features
   from historical_predictions
   where outcome is not null
   order by occurred_at desc
   limit ${i.lookbackRows}
  `,s=n(e),c=e.filter(e=>r(e.features).trainingEligible),l=y(c,i,await b());for(let e of l)await a`
    insert into model_governance_snapshots(
     model_name,sport,market_key,role,drift_status,
     baseline_sample_size,recent_sample_size,psi,mean_probability_shift,
     brier_delta,log_loss_delta,calibration_delta,avg_clv_delta,
     recent_brier_score,recent_log_loss,recent_calibration_error,recent_decayed_score,
     score,effective_score,weight_brake,runtime_multiplier,reason,model_version,as_of
    ) values(
     ${e.modelName},${e.sport},${e.marketKey},${e.role},${e.driftStatus},
     ${e.baselineSampleSize},${e.recentSampleSize},${e.psi},${e.meanProbabilityShift},
     ${e.brierDelta},${e.logLossDelta},${e.calibrationDelta},${e.avgClvDelta},
     ${e.recentBrierScore},${e.recentLogLoss},${e.recentCalibrationError},${e.recentDecayedScore},
     ${e.score},${e.effectiveScore},${e.weightBrake},${e.runtimeMultiplier},${e.reason},${t.modelVersion},now()
    )
   `;let u={champions:l.filter(e=>e.role===`CHAMPION`).length,challengers:l.filter(e=>e.role===`CHALLENGER`).length,watch:l.filter(e=>e.driftStatus===`WATCH`).length,drifting:l.filter(e=>e.driftStatus===`DRIFTING`).length,critical:l.filter(e=>e.driftStatus===`CRITICAL`).length};return await a`
   update model_governance_runs set
    completed_at=now(),status='completed',prediction_rows=${c.length},
    groups_evaluated=${l.length},champions=${u.champions},
    challengers=${u.challengers},watch_count=${u.watch},
    drifting_count=${u.drifting},critical_count=${u.critical},
    metrics=${a.json({options:i,settlementLearning:s,top:l.slice(0,50)})}
   where id=${o.id}
  `,{ok:!0,mode:`database`,runId:Number(o.id),rows:c.length,rowsRead:e.length,rowsExcludedByEvidence:s.excluded,settlementLearning:s,profiles:l,summary:u,options:i}}catch(e){throw await a`
   update model_governance_runs set completed_at=now(),status='failed',
    error_text=${e instanceof Error?e.message:`model governance failed`}
   where id=${o.id}
  `.catch(()=>void 0),e}}async function S(){let t=e();if(!t)return{};try{let e=await t`
   select distinct on (model_name,sport,market_key)
    model_name as "modelName",sport,market_key as "marketKey",runtime_multiplier::float as "runtimeMultiplier"
   from model_governance_snapshots
   order by model_name,sport,market_key,as_of desc
  `;return Object.fromEntries(e.map(e=>[c(String(e.modelName),String(e.sport),String(e.marketKey)),s(Number(e.runtimeMultiplier)||1,.35,1.05)]))}catch{return{}}}async function C(){let t=e();if(!t)return{ok:!0,source:`none`,latestRun:null,profiles:[],summary:{champions:0,challengers:0,watch:0,drifting:0,critical:0,averagePsi:0}};try{let[e]=await t`
   select id,model_version as "modelVersion",status,prediction_rows as "predictionRows",
    groups_evaluated as "groupsEvaluated",champions,challengers,
    watch_count as "watchCount",drifting_count as "driftingCount",critical_count as "criticalCount",
    started_at as "startedAt",completed_at as "completedAt",error_text as error
   from model_governance_runs order by started_at desc limit 1
  `,n=await t`
   select distinct on (model_name,sport,market_key)
    model_name as "modelName",sport,market_key as "marketKey",role,drift_status as "driftStatus",
    baseline_sample_size as "baselineSampleSize",recent_sample_size as "recentSampleSize",
    psi::float,mean_probability_shift::float as "meanProbabilityShift",
    brier_delta::float as "brierDelta",log_loss_delta::float as "logLossDelta",
    calibration_delta::float as "calibrationDelta",recent_brier_score::float as "recentBrierScore",
    recent_log_loss::float as "recentLogLoss",recent_calibration_error::float as "recentCalibrationError",
    score::float,effective_score::float as "effectiveScore",weight_brake::float as "weightBrake",
    runtime_multiplier::float as "runtimeMultiplier",reason,as_of as "asOf"
   from model_governance_snapshots
   order by model_name,sport,market_key,as_of desc
   limit 1000
  `,r={champions:n.filter(e=>e.role===`CHAMPION`).length,challengers:n.filter(e=>e.role===`CHALLENGER`).length,watch:n.filter(e=>e.driftStatus===`WATCH`).length,drifting:n.filter(e=>e.driftStatus===`DRIFTING`).length,critical:n.filter(e=>e.driftStatus===`CRITICAL`).length,averagePsi:n.length?n.reduce((e,t)=>e+Number(t.psi||0),0)/n.length:0};return{ok:!0,source:`database`,latestRun:e||null,profiles:n,summary:r}}catch(e){return{ok:!1,source:`database`,latestRun:null,profiles:[],summary:{champions:0,challengers:0,watch:0,drifting:0,critical:0,averagePsi:0},error:e instanceof Error?e.message:`model governance query failed`}}}export{p as a,c as i,C as n,x as o,S as r,y as t};