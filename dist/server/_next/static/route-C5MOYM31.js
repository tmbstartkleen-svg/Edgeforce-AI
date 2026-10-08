import{t as e}from"./db-9LtqYd6N.js";async function t(){let t=e();if(!t)return Response.json({source:`none`,models:[]});let n=await t`
  select sport,market_key as "marketKey",sample_size as "sampleSize",
   hit_rate as "hitRate",brier_score as "brierScore",
   log_loss as "logLoss",calibration_error as "calibrationError",
   roi,avg_clv as "avgClv",max_drawdown as "maxDrawdown",
   updated_at as "updatedAt"
  from sport_model_performance order by updated_at desc
 `;return Response.json({source:`database`,models:n})}export{t as GET};