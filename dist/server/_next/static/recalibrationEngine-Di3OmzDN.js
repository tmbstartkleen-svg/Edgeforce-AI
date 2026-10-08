import{t as e}from"./db-9LtqYd6N.js";import{r as t,t as n}from"./settlementLearning-BNFvsZJn.js";import{n as r,t as i}from"./backtest-C3tJhQT8.js";import{n as a}from"./modelCalibration-BEmX_mN5.js";import{t as o}from"./modelPerformance-MBoIKhzt.js";var s=(e,t,n)=>Math.max(t,Math.min(n,e));function c(){return{minSample:Math.max(25,Number(process.env.CALIBRATION_MIN_SAMPLE||50)),minHoldout:Math.max(10,Number(process.env.CALIBRATION_MIN_HOLDOUT||20)),shrinkageSamples:Math.max(25,Number(process.env.CALIBRATION_SHRINKAGE_SAMPLES||100)),maxAdjustment:s(Number(process.env.CALIBRATION_MAX_WEIGHT_ADJUSTMENT||.25),.05,.4),lookbackRows:Math.max(500,Number(process.env.CALIBRATION_LOOKBACK_ROWS||2e4)),trainSize:Math.max(25,Number(process.env.CALIBRATION_WALK_FORWARD_TRAIN||100)),testSize:Math.max(10,Number(process.env.CALIBRATION_WALK_FORWARD_TEST||25))}}function l(e){let t=new Map;for(let n of e){let e=[n.modelName,n.sport,n.marketKey].join(`|`),r=t.get(e)||[];r.push(n),t.set(e,r)}return t}function u(e,t,n,c,l){let u=[...c].sort((e,t)=>new Date(e.occurredAt).getTime()-new Date(t.occurredAt).getTime()),d=Math.max(l.minHoldout,Math.floor(u.length*.25)),f=u.slice(Math.max(0,u.length-d)),p=i(u),m=i(f),h=a(u),g=o(u)[0],_=r(u,Math.min(l.trainSize,Math.max(25,Math.floor(u.length*.6))),Math.min(l.testSize,Math.max(10,Math.floor(u.length*.2)))),v=_.length?_.reduce((e,t)=>e+t.test.brierScore,0)/_.length:m.brierScore,y=_.length?_.reduce((e,t)=>e+t.test.logLoss,0)/_.length:m.logLoss,b=!0,x=`Promoted after minimum-sample and holdout checks`;u.length<l.minSample?(b=!1,x=`Held: ${u.length} samples < ${l.minSample} minimum`):f.length<l.minHoldout?(b=!1,x=`Held: ${f.length} holdout samples < ${l.minHoldout} minimum`):m.brierScore>.32||m.logLoss>.85?(b=!1,x=`Held: holdout quality failed (Brier ${m.brierScore.toFixed(3)}, log loss ${m.logLoss.toFixed(3)})`):_.length&&v>.32&&(b=!1,x=`Held: walk-forward Brier ${v.toFixed(3)} exceeded 0.320`);let S=g?.decayedScore??0,C=g?.avgClv??0,w=h.meanAbsoluteCalibrationError,T=1+((S-.5)*.75-w*.9-Math.max(0,v-.25)*.8-Math.max(0,y-.693)*.15+s(C,-.05,.05)*1.2),E=p.effectiveSampleSize,D=m.effectiveSampleSize,O=E/(E+l.shrinkageSamples),k=1+(T-1)*O,A=b?s(k,1-l.maxAdjustment,1+l.maxAdjustment):1;return{modelName:e,sport:t,marketKey:n,sampleSize:u.length,effectiveSampleSize:E,holdoutSampleSize:f.length,holdoutEffectiveSampleSize:D,multiplier:A,promoted:b,reason:x,calibrationError:w,decayedScore:S,avgClv:C,brierScore:p.brierScore,logLoss:p.logLoss,roi:p.roi,walkForwardFolds:_.length,holdoutBrierScore:m.brierScore,holdoutLogLoss:m.logLoss}}function d(e,t=c()){return[...l(e).entries()].map(([e,n])=>{let[r,i,a]=e.split(`|`);return u(r,i,a,n,t)}).sort((e,t)=>e.promoted===t.promoted?Math.abs(t.multiplier-1)-Math.abs(e.multiplier-1):e.promoted?-1:1)}async function f(r=c()){let i=e();if(!i)return{ok:!0,mode:`dry-run`,rows:0,groups:[],options:r};let o=process.env.MODEL_VERSION||`edgeforce-v29`,[s]=await i`
  insert into recalibration_runs(model_version,status)
  values(${o},'running')
  returning id
 `;try{let e=await i`
   select occurred_at as "occurredAt",sport,market_key as "marketKey",model_name as "modelName",
    predicted_probability::float as predicted,offered_odds as odds,closing_odds as "closingOdds",outcome,features
   from historical_predictions
   where outcome is not null
   order by occurred_at desc
   limit ${r.lookbackRows}
  `,c=t(e),l=e.filter(e=>n(e.features).trainingEligible),u=d(l,r);for(let e of u){let t=a(l.filter(t=>t.modelName===e.modelName&&t.sport===e.sport&&t.marketKey===e.marketKey));await i`
    insert into model_calibration_profiles(
     model_name,sport,market_key,sample_size,calibration_error,
     overconfident_samples,underconfident_samples,buckets,as_of
    ) values(
     ${e.modelName},${e.sport},${e.marketKey},${e.sampleSize},${e.calibrationError},
     ${t.overconfidentSamples},${t.underconfidentSamples},
     ${i.json(t.buckets)},now()
    )
   `,await i`
    insert into rolling_model_rankings(
     model_name,sport,market_key,sample_size,decayed_score,confidence_label,
     brier_score,log_loss,roi,avg_clv,calibration_error,as_of
    ) values(
     ${e.modelName},${e.sport},${e.marketKey},${e.sampleSize},${e.decayedScore},
     ${e.sampleSize<r.minSample?`INSUFFICIENT`:e.decayedScore>=.72&&e.calibrationError<=.06?`HIGH`:e.decayedScore>=.62?`MEDIUM`:`LOW`},
     ${e.brierScore},${e.logLoss},${e.roi},${e.avgClv},${e.calibrationError},now()
    )
   `,await i`
    insert into learned_model_weight_snapshots(
     model_name,sport,market_key,multiplier,sample_size,calibration_error,decayed_score,avg_clv,
     as_of,model_version,holdout_sample_size,brier_score,log_loss,roi,confidence_label,promoted,reason
    ) values(
     ${e.modelName},${e.sport},${e.marketKey},${e.multiplier},${e.sampleSize},${e.calibrationError},
     ${e.decayedScore},${e.avgClv},now(),${o},${e.holdoutSampleSize},${e.brierScore},
     ${e.logLoss},${e.roi},${e.promoted?`PROMOTED`:`HELD`},${e.promoted},${e.reason}
    )
   `}let f=u.filter(e=>e.promoted).length;return await i`
   update recalibration_runs set
    completed_at=now(),status='completed',prediction_rows=${l.length},
    groups_evaluated=${u.length},groups_promoted=${f},groups_held=${u.length-f},
    metrics=${i.json({options:r,settlementLearning:c,topAdjustments:u.filter(e=>e.promoted).slice(0,20)})}
   where id=${s.id}
  `,{ok:!0,mode:`database`,runId:Number(s.id),rows:l.length,rowsRead:e.length,rowsExcludedByEvidence:c.excluded,settlementLearning:c,groups:u,promoted:f,held:u.length-f,options:r}}catch(e){throw await i`
   update recalibration_runs set completed_at=now(),status='failed',error_text=${e instanceof Error?e.message:`recalibration failed`}
   where id=${s.id}
  `.catch(()=>void 0),e}}export{f as n,d as t};