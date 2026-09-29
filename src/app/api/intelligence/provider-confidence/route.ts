import {db} from '@/lib/db';
import {providerConfidence} from '@/lib/providerConfidence';

export async function GET(){
 const sql=db();
 if(!sql)return Response.json({source:'none',providers:[]});
 const providers=await sql`
  select provider_id as id,name,priority,capabilities,enabled,
   latency_ms as "latencyMs",error_rate as "errorRate"
  from provider_health order by priority desc
 `;
 const metrics=await sql`
  select model_name as "modelName",count(*)::int as n,
   avg(case when closing_odds is not null then
    (case when closing_odds>0 then 1/(1+closing_odds/100.0) else 1/(1+100.0/abs(closing_odds)) end) -
    (case when offered_odds>0 then 1/(1+offered_odds/100.0) else 1/(1+100.0/abs(offered_odds)) end)
   end)::float as clv
  from historical_predictions
  group by model_name
 `;
 const byModel=new Map((metrics as any[]).map(m=>[m.modelName,m]));
 const output=(providers as any[]).map(p=>{
  const m=byModel.get(p.name)||{};
  return {...p,confidence:providerConfidence({provider:{...p,capabilities:p.capabilities||[]},historicalClv:m.clv||0,sampleSize:m.n||0,marketAgreement:.8})};
 });
 return Response.json({source:'database',providers:output});
}
