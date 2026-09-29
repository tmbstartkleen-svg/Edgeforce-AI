import {db} from '@/lib/db';
import {summarizeBacktest} from '@/lib/backtest';
import {normalizedWeights} from '@/lib/dynamicWeights';

export async function GET(req:Request){
 const {searchParams}=new URL(req.url);
 const sport=searchParams.get('sport');
 const market=searchParams.get('market');
 if(!sport||!market)return Response.json({error:'sport and market are required'},{status:400});
 const sql=db();
 if(!sql)return Response.json({source:'none',weights:[]});
 const rows=await sql`
  select model_name as "modelName", occurred_at as "occurredAt",
   predicted_probability::float as predicted, offered_odds as odds,
   closing_odds as "closingOdds", outcome
  from historical_predictions
  where sport=${sport} and market_key=${market} and outcome is not null
  order by occurred_at asc
 `;
 const grouped=new Map<string,any[]>();
 for(const row of rows){
  const arr=grouped.get(row.modelName)||[];
  arr.push(row); grouped.set(row.modelName,arr);
 }
 const models=[...grouped.entries()].map(([modelName,rs])=>({modelName,summary:summarizeBacktest(rs)}));
 return Response.json({source:'database',sport,market,weights:normalizedWeights(models)});
}
