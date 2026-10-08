import{t as e}from"./db-9LtqYd6N.js";import{t}from"./releaseManifest-bHjF1npa.js";import{t as n}from"./settlementLearning-BNFvsZJn.js";import{n as r,t as i}from"./backtest-C3tJhQT8.js";import{n as a,t as o}from"./modelCalibration-BEmX_mN5.js";var s=(e,t=0,n=1)=>Math.max(t,Math.min(n,e)),c=e=>e>0?1+e/100:1+100/Math.max(1,Math.abs(e)),l=e=>s(1/c(e),.001,.999),u=e=>{let t=Number(e);return Number.isFinite(t)&&t>0&&t<1?t:void 0},d=e=>e.length?e.reduce((e,t)=>e+t,0)/e.length:0,f=e=>e.features&&typeof e.features==`object`?e.features:{},p=e=>{let t=f(e).contextQuality;return t&&typeof t==`object`?t:null},m=e=>{let t=f(e);return u(t.simProbability??t.rawSimProbability??t.sportModelProbability)};function h(e,t){let n=s(e,.001,.999);return-(t*Math.log(n)+(1-t)*Math.log(1-n))}function g(e){if(!e.length)return{brierScore:0,logLoss:0};let t=0,n=0;for(let r of e){let e=l(r.odds);t+=(e-r.outcome)**2,n+=h(e,r.outcome)}return{brierScore:t/e.length,logLoss:n/e.length}}function _(e){return[{label:`0-49%`,min:0,max:.5},{label:`50-54%`,min:.5,max:.55},{label:`55-59%`,min:.55,max:.6},{label:`60-64%`,min:.6,max:.65},{label:`65-69%`,min:.65,max:.7},{label:`70-74%`,min:.7,max:.75},{label:`75-79%`,min:.75,max:.8},{label:`80-84%`,min:.8,max:.85},{label:`85%+`,min:.85,max:1.001}].map(t=>{let n=e.filter(e=>e.predicted>=t.min&&e.predicted<t.max),r=n.length?d(n.map(e=>e.predicted)):0,i=n.length?d(n.map(e=>e.outcome)):0,a=n.length?d(n.map(e=>(e.predicted-e.outcome)**2)):0;return{...t,sampleSize:n.length,predicted:r,actual:i,error:r-i,brierScore:a}})}function v(e,t){let n=e.map(e=>{let n=t(e);if(n===void 0)return null;let r=(e.predicted-e.outcome)**2,i=(n-e.outcome)**2;return{baseline:r,alternative:i,delta:i-r}}).filter(e=>!!e);if(n.length<2)return{sampleSize:n.length,baselineBrier:n[0]?.baseline??0,alternativeBrier:n[0]?.alternative??0,brierDelta:n[0]?.delta??0,standardError:0,ci95:[0,0],better:`INSUFFICIENT`};let r=n.map(e=>e.delta),i=d(r),a=r.reduce((e,t)=>e+(t-i)**2,0)/(r.length-1),o=Math.sqrt(a/r.length),s=1.96*o,c=[i-s,i+s],l=c[1]<0?`ALTERNATIVE`:c[0]>0?`BASELINE`:`TIE`;return{sampleSize:n.length,baselineBrier:d(n.map(e=>e.baseline)),alternativeBrier:d(n.map(e=>e.alternative)),brierDelta:i,standardError:o,ci95:c,better:l}}function y(e){let t=e.filter(e=>{let t=p(e);return!!t&&(Number(t?.coverage)||0)>=.55&&(t?.recommendationReady===!0||(Number(t?.criticalCoverage)||0)>=.66)}),n=e.filter(e=>{let t=p(e);return!t||(Number(t?.coverage)||0)<.55}),r=i(t),a=i(n);return{richSampleSize:t.length,thinSampleSize:n.length,richBrier:r.brierScore,thinBrier:a.brierScore,richLogLoss:r.logLoss,thinLogLoss:a.logLoss,brierDelta:t.length&&n.length?r.brierScore-a.brierScore:0,logLossDelta:t.length&&n.length?r.logLoss-a.logLoss:0,note:`Observational comparison only; context-rich and context-thin rows may differ by sport, market, timing, and difficulty.`}}function b(e){let t=[...e].sort((e,t)=>new Date(e.occurredAt).getTime()-new Date(t.occurredAt).getTime()),n=Math.max(1,Math.floor(t.length*.25));return t.slice(Math.max(0,t.length-n))}function x(e){let t=i(e),n=a(e),s=g(e),c=b(e),l=i(c),u=a(c),f=r(e,Math.min(200,Math.max(25,Math.floor(e.length*.6))),Math.min(50,Math.max(10,Math.floor(e.length*.2)))),p=f.length?d(f.map(e=>e.test.brierScore)):l.brierScore,h=f.length?d(f.map(e=>e.test.logLoss)):l.logLoss,x=s.brierScore>0?1-t.brierScore/s.brierScore:0,S=s.logLoss>0?(s.logLoss-t.logLoss)/s.logLoss:0;return{summary:t,calibrationError:n.meanAbsoluteCalibrationError,calibrationBuckets:o(e),confidenceBands:_(e),marketBaselineBrier:s.brierScore,marketBaselineLogLoss:s.logLoss,brierSkillScore:x,logLossImprovement:S,holdout:l,holdoutCalibrationError:u.meanAbsoluteCalibrationError,walkForwardFolds:f.length,walkForwardBrier:p,walkForwardLogLoss:h,simulationComparison:v(e,m),contextContribution:y(e)}}function S(e,t){let n=e.length,r=t.holdout.sampleSize;return n<25||r<8?{evidenceGrade:`INSUFFICIENT`,promotionEligible:!1,reason:`Insufficient settled history: ${n} samples, ${r} holdout`}:t.holdout.brierScore>.32||t.holdout.logLoss>.85||t.holdoutCalibrationError>.14||t.brierSkillScore<-.08?{evidenceGrade:`FAILED`,promotionEligible:!1,reason:`Holdout quality failed: Brier ${t.holdout.brierScore.toFixed(3)}, log loss ${t.holdout.logLoss.toFixed(3)}, calibration ${t.holdoutCalibrationError.toFixed(3)}, skill ${t.brierSkillScore.toFixed(3)}`}:n<75||r<20||t.walkForwardFolds<1?{evidenceGrade:`PROVISIONAL`,promotionEligible:!1,reason:`Promising but not enough out-of-sample depth: ${n} samples, ${r} holdout, ${t.walkForwardFolds} folds`}:t.holdout.brierScore<=.28&&t.holdout.logLoss<=.78&&t.holdoutCalibrationError<=.1&&t.brierSkillScore>=0&&t.summary.avgClv>=-.02?n>=200&&r>=50&&t.walkForwardFolds>=3&&t.holdout.brierScore<=.25&&t.holdoutCalibrationError<=.075&&t.brierSkillScore>=.03?{evidenceGrade:`VERIFIED`,promotionEligible:!0,reason:`Verified with deep settled history, multiple walk-forward folds, positive market-relative skill, and calibrated holdout performance`}:{evidenceGrade:`QUALIFIED`,promotionEligible:!0,reason:`Qualified by minimum out-of-sample, calibration, CLV, and market-relative skill gates`}:{evidenceGrade:`PROVISIONAL`,promotionEligible:!1,reason:`Evidence not yet strong enough for promotion: holdout Brier ${t.holdout.brierScore.toFixed(3)}, calibration ${t.holdoutCalibrationError.toFixed(3)}, skill ${t.brierSkillScore.toFixed(3)}, CLV ${t.summary.avgClv.toFixed(3)}`}}function C(e){let t=new Map;for(let n of e){let e=[n.modelName,n.sport,n.marketKey].join(`|`);t.set(e,[...t.get(e)||[],n])}return[...t.entries()].map(([e,t])=>{let[n,r,i]=e.split(`|`),a=x(t),o=S(t,a);return{modelName:n,sport:r,marketKey:i,sampleSize:t.length,holdoutSampleSize:a.holdout.sampleSize,...o,metrics:a}}).sort((e,t)=>{let n=e=>e===`VERIFIED`?0:e===`QUALIFIED`?1:e===`PROVISIONAL`?2:e===`INSUFFICIENT`?3:4;return n(e.evidenceGrade)-n(t.evidenceGrade)||t.sampleSize-e.sampleSize})}function w(e,t){let n=new Map;for(let r of e){let e=String(r[t]);n.set(e,[...n.get(e)||[],r])}return[...n.entries()].map(([e,n])=>({[t]:e,sampleSize:n.length,metrics:x(n)}))}function T(e){let t=C(e),n={verified:t.filter(e=>e.evidenceGrade===`VERIFIED`).length,qualified:t.filter(e=>e.evidenceGrade===`QUALIFIED`).length,provisional:t.filter(e=>e.evidenceGrade===`PROVISIONAL`).length,insufficient:t.filter(e=>e.evidenceGrade===`INSUFFICIENT`).length,failed:t.filter(e=>e.evidenceGrade===`FAILED`).length,promotionEligible:t.filter(e=>e.promotionEligible).length};return{generatedAt:new Date().toISOString(),sampleSize:e.length,overall:x(e),groups:t,bySport:w(e,`sport`),byMarket:w(e,`marketKey`),evidence:n,diagnostics:{contextTaggedRows:e.filter(e=>!!p(e)).length,simulationTaggedRows:e.filter(e=>m(e)!==void 0).length,closingLineRows:e.filter(e=>Number.isFinite(Number(e.closingOdds))).length,modelVersions:[...new Set(e.map(e=>String(e.modelVersion||`unknown`)))].sort()}}}async function E(t=Math.max(1e3,Number(process.env.VALIDATION_LOOKBACK_ROWS)||3e4)){let r=e();return r?(await r`
  select occurred_at as "occurredAt",sport,market_key as "marketKey",selection_key as "selectionKey",
   model_name as "modelName",model_version as "modelVersion",
   predicted_probability::float as predicted,offered_odds as odds,closing_odds as "closingOdds",
   outcome,features
  from historical_predictions
  where outcome is not null
  order by occurred_at desc
  limit ${t}
 `).filter(e=>n(e.features).trainingEligible):[]}async function D(){let n=e();if(!n)return{ok:!0,mode:`dry-run`,report:T([])};let[r]=await n`
  insert into validation_runs(model_version,status,started_at)
  values(${t.modelVersion},'running',now())
  returning id
 `;try{let e=T(await E());for(let i of e.groups)await n`
    insert into validation_snapshots(
     validation_run_id,model_name,sport,market_key,sample_size,holdout_sample_size,
     brier_score,log_loss,calibration_error,brier_skill_score,avg_clv,roi,
     walk_forward_folds,walk_forward_brier,context_brier_delta,simulation_brier_delta,
     evidence_grade,promotion_eligible,reason,metrics,model_version,as_of
    ) values(
     ${r.id},${i.modelName},${i.sport},${i.marketKey},${i.sampleSize},${i.holdoutSampleSize},
     ${i.metrics.summary.brierScore},${i.metrics.summary.logLoss},${i.metrics.calibrationError},
     ${i.metrics.brierSkillScore},${i.metrics.summary.avgClv},${i.metrics.summary.roi},
     ${i.metrics.walkForwardFolds},${i.metrics.walkForwardBrier},
     ${i.metrics.contextContribution.brierDelta},${i.metrics.simulationComparison.brierDelta},
     ${i.evidenceGrade},${i.promotionEligible},${i.reason},
     ${n.json(i.metrics)},${t.modelVersion},now()
    )
   `;return await n`
   update validation_runs set
    completed_at=now(),status='completed',prediction_rows=${e.sampleSize},
    groups_evaluated=${e.groups.length},evidence_passed=${e.evidence.promotionEligible},
    evidence_held=${e.groups.length-e.evidence.promotionEligible},
    overall=${n.json(e.overall)},diagnostics=${n.json(e.diagnostics)}
   where id=${r.id}
  `,{ok:!0,mode:`database`,runId:Number(r.id),report:e}}catch(e){throw await n`
   update validation_runs set completed_at=now(),status='failed',
    error_text=${e instanceof Error?e.message:`validation lab failed`}
   where id=${r.id}
  `.catch(()=>void 0),e}}async function O(){let t=e();if(!t)return{ok:!0,source:`none`,latestRun:null,snapshots:[],report:T([])};try{let e=T(await E()),[n]=await t`
   select id,model_version as "modelVersion",status,prediction_rows as "predictionRows",
    groups_evaluated as "groupsEvaluated",evidence_passed as "evidencePassed",
    evidence_held as "evidenceHeld",overall,diagnostics,started_at as "startedAt",
    completed_at as "completedAt",error_text as error
   from validation_runs order by started_at desc limit 1
  `,r=await t`
   select distinct on (model_name,sport,market_key)
    model_name as "modelName",sport,market_key as "marketKey",sample_size as "sampleSize",
    holdout_sample_size as "holdoutSampleSize",brier_score::float as "brierScore",
    log_loss::float as "logLoss",calibration_error::float as "calibrationError",
    brier_skill_score::float as "brierSkillScore",avg_clv::float as "avgClv",roi::float,
    walk_forward_folds as "walkForwardFolds",walk_forward_brier::float as "walkForwardBrier",
    context_brier_delta::float as "contextBrierDelta",simulation_brier_delta::float as "simulationBrierDelta",
    evidence_grade as "evidenceGrade",promotion_eligible as "promotionEligible",reason,as_of as "asOf"
   from validation_snapshots
   order by model_name,sport,market_key,as_of desc
   limit 1000
  `;return{ok:!0,source:`database`,latestRun:n||null,snapshots:r,report:e}}catch(e){return{ok:!1,source:`database`,latestRun:null,snapshots:[],report:T([]),error:e instanceof Error?e.message:`validation lab query failed`}}}async function k(){let t=e();if(!t)return{};try{let e=await t`
   select distinct on (model_name,sport,market_key)
    model_name as "modelName",sport,market_key as "marketKey",
    evidence_grade as "evidenceGrade",promotion_eligible as "promotionEligible",
    brier_skill_score::float as "brierSkillScore"
   from validation_snapshots
   order by model_name,sport,market_key,as_of desc
  `;return Object.fromEntries(e.map(e=>{let t=[e.modelName,e.sport,e.marketKey].join(`|`),n=String(e.evidenceGrade),r=!!e.promotionEligible,i=Number(e.brierSkillScore)||0;return[t,r?s(1+Math.min(.04,Math.max(0,i)*.2),.95,1.04):n===`FAILED`?.55:n===`PROVISIONAL`?.88:n===`INSUFFICIENT`?.96:.92]}))}catch{return{}}}export{D as a,v as i,O as n,k as r,T as t};