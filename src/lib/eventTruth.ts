import {db} from './db';

export type ResolutionStatus='OPEN'|'PROVISIONAL'|'RESOLVED'|'DISPUTED'|'VOID';
export type ForecastDomain='SPORTS'|'MARKETS';

export type ForecastGradeInput={
 forecastId:string;
 eventKey:string;
 domain:ForecastDomain;
 category:string;
 venue?:string;
 modelVersion:string;
 predictedProbability:number;
 marketProbability?:number;
 outcome:boolean;
 settledAt?:string;
};

export function scoreBinaryForecast(probability:number,outcome:boolean){
 const p=Math.max(.001,Math.min(.999,probability));
 const y=outcome?1:0;
 const brier=(p-y)**2;
 const logLoss=-(y*Math.log(p)+(1-y)*Math.log(1-p));
 const calibrationError=Math.abs(p-y);
 return {brier,logLoss,calibrationError};
}

export async function recordResolution(input:{
 eventKey:string;
 domain:ForecastDomain;
 category:string;
 status:ResolutionStatus;
 outcome?:boolean|null;
 resolutionSource:string;
 resolutionRule?:string;
 resolvedAt?:string;
 metadata?:Record<string,unknown>;
}){
 const sql=db();
 if(!sql)return {mode:'memory' as const,written:false};
 await sql`
  insert into universal_event_resolutions(
   event_key,domain,category,status,outcome,resolution_source,resolution_rule,resolved_at,metadata,updated_at
  ) values(
   ${input.eventKey},${input.domain},${input.category},${input.status},${input.outcome??null},
   ${input.resolutionSource},${input.resolutionRule??null},${input.resolvedAt??null},
   ${sql.json(input.metadata||{})},now()
  )
  on conflict(event_key) do update set
   domain=excluded.domain,
   category=excluded.category,
   status=excluded.status,
   outcome=excluded.outcome,
   resolution_source=excluded.resolution_source,
   resolution_rule=excluded.resolution_rule,
   resolved_at=excluded.resolved_at,
   metadata=excluded.metadata,
   updated_at=now()
 `;
 return {mode:'database' as const,written:true};
}

export async function gradeForecast(input:ForecastGradeInput){
 const metrics=scoreBinaryForecast(input.predictedProbability,input.outcome);
 const marketMetrics=input.marketProbability===undefined?null:scoreBinaryForecast(input.marketProbability,input.outcome);
 const marketSkill=marketMetrics===null?null:marketMetrics.brier-metrics.brier;
 const sql=db();
 if(sql){
  await sql`
   insert into universal_forecast_grades(
    forecast_id,event_key,domain,category,venue,model_version,predicted_probability,market_probability,
    outcome,brier,log_loss,calibration_error,market_skill,settled_at
   ) values(
    ${input.forecastId},${input.eventKey},${input.domain},${input.category},${input.venue??null},
    ${input.modelVersion},${input.predictedProbability},${input.marketProbability??null},
    ${input.outcome},${metrics.brier},${metrics.logLoss},${metrics.calibrationError},${marketSkill},
    ${input.settledAt||new Date().toISOString()}
   )
   on conflict(forecast_id) do update set
    outcome=excluded.outcome,
    brier=excluded.brier,
    log_loss=excluded.log_loss,
    calibration_error=excluded.calibration_error,
    market_skill=excluded.market_skill,
    settled_at=excluded.settled_at
  `;
 }
 return {...metrics,marketSkill,persisted:Boolean(sql)};
}

export async function truthSummary(){
 const sql=db();
 if(!sql)return {configured:false,rows:[],totals:{graded:0}};
 const rows=await sql`
  select domain,category,model_version,
   count(*)::int as graded,
   avg(brier)::float8 as brier,
   avg(log_loss)::float8 as log_loss,
   avg(calibration_error)::float8 as calibration_error,
   avg(market_skill)::float8 as market_skill
  from universal_forecast_grades
  group by domain,category,model_version
  order by graded desc,domain,category
  limit 250
 `;
 const totals=await sql`select count(*)::int as graded from universal_forecast_grades`;
 return {configured:true,rows,totals:totals[0]||{graded:0}};
}
