import {db} from '@/lib/db';

export const dynamic='force-dynamic';

export async function GET(){
 const sql=db();
 if(!sql)return Response.json({source:'none',latestRun:null,weights:[],models:[]},{headers:{'Cache-Control':'no-store'}});
 try{
  const [latestRun]=await sql`
   select id,model_version as "modelVersion",started_at as "startedAt",completed_at as "completedAt",
    status,prediction_rows as "predictionRows",groups_evaluated as "groupsEvaluated",
    groups_promoted as "groupsPromoted",groups_held as "groupsHeld",metrics,error_text as "error"
   from recalibration_runs order by started_at desc limit 1
  `;
  const weights=await sql`
   select distinct on (model_name,sport,market_key)
    model_name as "modelName",sport,market_key as "marketKey",multiplier::float,
    sample_size as "sampleSize",holdout_sample_size as "holdoutSampleSize",
    calibration_error::float as "calibrationError",brier_score::float as "brierScore",
    log_loss::float as "logLoss",roi::float,confidence_label as "confidenceLabel",
    promoted,reason,as_of as "asOf"
   from learned_model_weight_snapshots
   order by model_name,sport,market_key,as_of desc
   limit 250
  `;
  const models=await sql`
   select distinct on (model_name,sport,market_key)
    model_name as "modelName",sport,market_key as "marketKey",sample_size as "sampleSize",
    decayed_score::float as "decayedScore",confidence_label as "confidenceLabel",
    brier_score::float as "brierScore",log_loss::float as "logLoss",roi::float,
    avg_clv::float as "avgClv",calibration_error::float as "calibrationError",as_of as "asOf"
   from rolling_model_rankings
   order by model_name,sport,market_key,as_of desc
   limit 250
  `;
  return Response.json({source:'database',latestRun:latestRun||null,weights,models},{headers:{'Cache-Control':'no-store'}});
 }catch(error){
  return Response.json({source:'database',latestRun:null,weights:[],models:[],error:error instanceof Error?error.message:'calibration query failed'},{headers:{'Cache-Control':'no-store'}});
 }
}
