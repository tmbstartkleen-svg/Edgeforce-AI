import {db} from '@/lib/db';
import {buildForecastResearchReport,type HistoricalPrediction} from '@/lib/forecastResearchLab';

export const dynamic='force-dynamic';

export async function GET(req:Request){
 const {searchParams}=new URL(req.url);
 const sport=searchParams.get('sport');
 const market=searchParams.get('market');
 const model=searchParams.get('model');
 const days=Math.max(1,Math.min(3650,Number(searchParams.get('days')||365)));
 const limit=Math.max(50,Math.min(20000,Number(searchParams.get('limit')||5000)));
 const sql=db();
 if(!sql){
  return Response.json({
   ok:true,source:'none',filters:{sport,market,model,days,limit},
   report:buildForecastResearchReport([])
  },{headers:{'Cache-Control':'no-store'}});
 }
 const rows=await sql`
  select
   occurred_at as "occurredAt",
   sport,
   market_key as "marketKey",
   model_name as "modelName",
   model_version as "modelVersion",
   selection_key as "selectionKey",
   predicted_probability::float as predicted,
   offered_odds as odds,
   outcome,
   features
  from historical_predictions
  where outcome is not null
   and occurred_at>=now()-make_interval(days=>${days})
   and (${sport}::text is null or sport=${sport})
   and (${market}::text is null or market_key=${market})
   and (${model}::text is null or model_name=${model})
  order by occurred_at asc
  limit ${limit}
 `;
 const history=(rows as any[]).map(row=>({
  occurredAt:new Date(row.occurredAt).toISOString(),
  sport:String(row.sport),
  marketKey:String(row.marketKey),
  modelName:String(row.modelName),
  modelVersion:row.modelVersion?String(row.modelVersion):undefined,
  selectionKey:row.selectionKey?String(row.selectionKey):undefined,
  predicted:Number(row.predicted),
  odds:Number(row.odds||0),
  outcome:Number(row.outcome) as 0|1,
  features:row.features&&typeof row.features==='object'?row.features:{}
 })) as HistoricalPrediction[];
 return Response.json({
  ok:true,
  source:'database',
  filters:{sport,market,model,days,limit},
  rows:history.length,
  report:buildForecastResearchReport(history)
 },{headers:{'Cache-Control':'no-store'}});
}
