import{t as e}from"./db-9LtqYd6N.js";var t={councilWeight:0,simulationWeight:1,marketWeight:0},n=(e,t=0,n=1)=>Math.max(t,Math.min(n,e)),r=e=>n(e,.001,.999),i=e=>String(e||``).trim().toUpperCase(),a=(e,t)=>`${i(e)}|${String(t||``).trim().toLowerCase()}`;function o(e){return!Number.isFinite(e)||e===0?.5:e>0?100/(e+100):Math.abs(e)/(Math.abs(e)+100)}function s(e,t){let n=r(e);return-(t*Math.log(n)+(1-t)*Math.log(1-n))}function c(e,t){return r(e.councilProbability*t.councilWeight+e.simulationProbability*t.simulationWeight+e.marketProbability*t.marketWeight)}function l(e,t){if(!e.length)return{brier:0,logLoss:0,calibration:0,meanPrediction:0,actual:0};let n=0,r=0,i=0,a=0;for(let o of e){let e=c(o,t);n+=(e-o.outcome)**2,r+=s(e,o.outcome),i+=e,a+=o.outcome}let o=e.length;return{brier:n/o,logLoss:r/o,calibration:Math.abs(i/o-a/o),meanPrediction:i/o,actual:a/o}}function u(e,t){let n=l(e,t);return n.brier+n.logLoss*.035+n.calibration*.06}function d(){let e=[];for(let t=40;t<=100;t+=5)for(let n=0;n<=25;n+=5){let r=t/100,i=n/100,a=1-r-i;a<-1e-4||a>.55||e.push({councilWeight:Math.max(0,a),simulationWeight:r,marketWeight:i})}return e}var f=d();function p(e){let t=n(e.councilWeight),r=n(e.simulationWeight),i=n(e.marketWeight),a=t+r+i||1;return{councilWeight:t/a,simulationWeight:r/a,marketWeight:i/a}}function m(e,t,n,r){let i=n/(n+r);return p({councilWeight:t.councilWeight+(e.councilWeight-t.councilWeight)*i,simulationWeight:t.simulationWeight+(e.simulationWeight-t.simulationWeight)*i,marketWeight:t.marketWeight+(e.marketWeight-t.marketWeight)*i})}function h(e){let t=[...e].sort((e,t)=>new Date(e.occurredAt).getTime()-new Date(t.occurredAt).getTime()),n=Math.max(1,Math.floor(t.length*.25));return{train:t.slice(0,Math.max(1,t.length-n)),holdout:t.slice(Math.max(1,t.length-n))}}function g(e){let{rows:t,sport:r,marketKey:i,scope:a,prior:o,minSample:s,shrinkageSamples:c}=e,{train:d,holdout:p}=h(t),g=o,_=u(d,o);for(let e of f){let t=u(d,e);t<_-1e-9&&(g=e,_=t)}let v=m(g,o,d.length,c),y=l(d,v),b=l(p,v),x=l(p,o),S=x.brier-b.brier,C=Math.max(10,Math.floor(s*.22)),w=t.length>=s&&p.length>=C,T=b.logLoss<=x.logLoss+.006,E=S>=5e-4,D=w&&E&&T,O=n(t.length/(t.length+c)*(.35+.65*n(Math.max(0,S)/.012,0,1)),0,1),k=w?E?T?`Promoted: holdout Brier improved by ${S.toFixed(4)} with stable log loss`:`Held: holdout log loss ${b.logLoss.toFixed(4)} exceeded prior ${x.logLoss.toFixed(4)} + 0.006`:`Held: holdout Brier gain ${S.toFixed(4)} below 0.0005`:`Held: ${t.length} rows / ${p.length} holdout below ${s} / ${C}`;return{sport:r,marketKey:i,scope:a,sampleCount:t.length,trainCount:d.length,holdoutCount:p.length,...v,priorCouncilWeight:o.councilWeight,priorSimulationWeight:o.simulationWeight,priorMarketWeight:o.marketWeight,trainBrier:y.brier,holdoutBrier:b.brier,baselineHoldoutBrier:x.brier,holdoutLogLoss:b.logLoss,baselineHoldoutLogLoss:x.logLoss,holdoutBrierGain:S,confidence:O,promoted:D,reason:k}}function _(e){let n=e.filter(e=>Number.isFinite(e.councilProbability)&&e.councilProbability>0&&e.councilProbability<1&&Number.isFinite(e.simulationProbability)&&e.simulationProbability>0&&e.simulationProbability<1&&Number.isFinite(e.marketProbability)&&e.marketProbability>0&&e.marketProbability<1&&(e.outcome===0||e.outcome===1));if(!n.length)return[];let r=[],o=g({rows:n,sport:`*`,marketKey:`*`,scope:`GLOBAL`,prior:t,minSample:120,shrinkageSamples:180});r.push(o);let s=o.promoted?o:{...o,...t},c=new Map;for(let e of n){let t=i(e.sport);c.set(t,[...c.get(t)||[],e])}let l=new Map;for(let[e,t]of c){let n=g({rows:t,sport:e,marketKey:`*`,scope:`SPORT`,prior:{councilWeight:s.councilWeight,simulationWeight:s.simulationWeight,marketWeight:s.marketWeight},minSample:75,shrinkageSamples:130});r.push(n),l.set(e,n)}let u=new Map;for(let e of n){let t=a(i(e.sport),String(e.marketKey||``).trim().toLowerCase());u.set(t,[...u.get(t)||[],e])}for(let[e,t]of u){let[n,i]=e.split(`|`),a=l.get(n),o=a?.promoted?a:s;r.push(g({rows:t,sport:n,marketKey:i,scope:`SPORT_MARKET`,prior:{councilWeight:o.councilWeight,simulationWeight:o.simulationWeight,marketWeight:o.marketWeight},minSample:40,shrinkageSamples:90}))}return r}function v(e){let t=Number(e.councilProbability),n=e.features&&typeof e.features==`object`?e.features:{},r=Number(n.rawSimProbability??n.simProbability),i=Number(n?.consensus?.consensusProbability),a=Number.isFinite(i)&&i>0&&i<1?i:o(Number(e.offeredOdds)),s=Number(e.outcome);return!Number.isFinite(t)||!Number.isFinite(r)||!Number.isFinite(a)||s!==0&&s!==1?null:{occurredAt:new Date(e.occurredAt).toISOString(),sport:String(e.sport||``),marketKey:String(e.marketKey||``),councilProbability:t,simulationProbability:r,marketProbability:a,outcome:s}}async function y(){let t=e();if(!t)return{configured:!1,settledRowsRead:0,eligibleRows:0,profilesWritten:0,profilesPromoted:0};let n=await t`insert into cross_sport_optimizer_runs(model_version) values(${process.env.MODEL_VERSION||`edgeforce-v61`}) returning id`,r=Number(n[0]?.id||0),i=await t`
  select occurred_at as "occurredAt",sport,market_key as "marketKey",
   predicted_probability::float as "councilProbability",offered_odds as "offeredOdds",outcome,features
  from historical_predictions
  where outcome is not null and model_name='Model Council'
   and occurred_at>=now()-interval '730 days'
  order by occurred_at asc
  limit 50000
 `,a=i.map(v).filter(e=>!!e),o=_(a),s=0;for(let e of o)e.promoted&&s++,await t`
   insert into cross_sport_optimizer_profiles(
    sport,market_key,scope,sample_count,train_count,holdout_count,
    council_weight,simulation_weight,market_weight,
    prior_council_weight,prior_simulation_weight,prior_market_weight,
    train_brier,holdout_brier,baseline_holdout_brier,holdout_log_loss,baseline_holdout_log_loss,
    holdout_brier_gain,confidence,promoted,reason,updated_at,metadata
   ) values(
    ${e.sport},${e.marketKey},${e.scope},${e.sampleCount},${e.trainCount},${e.holdoutCount},
    ${e.councilWeight},${e.simulationWeight},${e.marketWeight},
    ${e.priorCouncilWeight},${e.priorSimulationWeight},${e.priorMarketWeight},
    ${e.trainBrier},${e.holdoutBrier},${e.baselineHoldoutBrier},${e.holdoutLogLoss},${e.baselineHoldoutLogLoss},
    ${e.holdoutBrierGain},${e.confidence},${e.promoted},${e.reason},now(),
    ${t.json({optimizer:`v70-grid-hierarchical`,candidateCount:f.length})}
   )
   on conflict (sport,market_key) do update set
    scope=excluded.scope,sample_count=excluded.sample_count,train_count=excluded.train_count,holdout_count=excluded.holdout_count,
    council_weight=excluded.council_weight,simulation_weight=excluded.simulation_weight,market_weight=excluded.market_weight,
    prior_council_weight=excluded.prior_council_weight,prior_simulation_weight=excluded.prior_simulation_weight,prior_market_weight=excluded.prior_market_weight,
    train_brier=excluded.train_brier,holdout_brier=excluded.holdout_brier,baseline_holdout_brier=excluded.baseline_holdout_brier,
    holdout_log_loss=excluded.holdout_log_loss,baseline_holdout_log_loss=excluded.baseline_holdout_log_loss,
    holdout_brier_gain=excluded.holdout_brier_gain,confidence=excluded.confidence,promoted=excluded.promoted,reason=excluded.reason,
    updated_at=now(),metadata=excluded.metadata
  `;return r&&await t`
  update cross_sport_optimizer_runs set settled_rows_read=${i.length},eligible_rows=${a.length},
   profiles_written=${o.length},profiles_promoted=${s},completed_at=now(),
   metadata=${t.json({lookbackDays:730,candidateCount:f.length})}
  where id=${r}
 `,{configured:!0,settledRowsRead:i.length,eligibleRows:a.length,profilesWritten:o.length,profilesPromoted:s}}async function b(){let t=e();if(!t)return{};try{let e=await t`
   select sport,market_key as "marketKey",scope,sample_count as "sampleCount",train_count as "trainCount",holdout_count as "holdoutCount",
    council_weight::float as "councilWeight",simulation_weight::float as "simulationWeight",market_weight::float as "marketWeight",
    prior_council_weight::float as "priorCouncilWeight",prior_simulation_weight::float as "priorSimulationWeight",prior_market_weight::float as "priorMarketWeight",
    train_brier::float as "trainBrier",holdout_brier::float as "holdoutBrier",baseline_holdout_brier::float as "baselineHoldoutBrier",
    holdout_log_loss::float as "holdoutLogLoss",baseline_holdout_log_loss::float as "baselineHoldoutLogLoss",
    holdout_brier_gain::float as "holdoutBrierGain",confidence::float,promoted,reason
   from cross_sport_optimizer_profiles where promoted=true
  `,n={};for(let t of e)n[a(String(t.sport),String(t.marketKey))]=t;return n}catch{return{}}}function x(e,t,n){if(e)return e[a(t,n)]??e[a(t,`*`)]??e[a(`*`,`*`)]}function S(e,n,i,a){if(!e||!e.promoted)return{probability:r(i),applied:!1,weights:t,confidence:0,scope:`NONE`};let o=p(e);return{probability:r(r(n)*o.councilWeight+r(i)*o.simulationWeight+r(a)*o.marketWeight),applied:!0,weights:o,confidence:e.confidence,scope:e.scope}}async function C(){let t=e();if(!t)return{configured:!1,profiles:0,promoted:0,latestRun:null,rows:[]};let[n,r,i]=await Promise.all([t`select count(*)::int as profiles,count(*) filter(where promoted)::int as promoted from cross_sport_optimizer_profiles`,t`select id,settled_rows_read as "settledRowsRead",eligible_rows as "eligibleRows",profiles_written as "profilesWritten",profiles_promoted as "profilesPromoted",started_at as "startedAt",completed_at as "completedAt" from cross_sport_optimizer_runs order by started_at desc limit 1`,t`
   select sport,market_key as "marketKey",scope,sample_count as "sampleCount",holdout_count as "holdoutCount",
    council_weight::float as "councilWeight",simulation_weight::float as "simulationWeight",market_weight::float as "marketWeight",
    holdout_brier::float as "holdoutBrier",baseline_holdout_brier::float as "baselineHoldoutBrier",
    holdout_brier_gain::float as "holdoutBrierGain",confidence::float,promoted,reason,updated_at as "updatedAt"
   from cross_sport_optimizer_profiles
   order by promoted desc,holdout_brier_gain desc,sample_count desc limit 40
  `]),a=n[0]||{};return{configured:!0,profiles:Number(a.profiles||0),promoted:Number(a.promoted||0),latestRun:r[0]||null,rows:i}}export{a,C as i,_ as n,y as o,b as r,x as s,S as t};