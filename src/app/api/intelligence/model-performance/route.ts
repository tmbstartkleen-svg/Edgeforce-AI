import {db} from '@/lib/db';
import {rollingModelPerformance} from '@/lib/modelPerformance';

export async function GET(req:Request){
 const {searchParams}=new URL(req.url);
 const sport=searchParams.get('sport');
 const market=searchParams.get('market');
 const sql=db();
 if(!sql)return Response.json({source:'none',models:[]});
 const rows=await sql`
  select occurred_at as "occurredAt",sport,market_key as "marketKey",model_name as "modelName",
   predicted_probability::float as predicted,offered_odds as odds,closing_odds as "closingOdds",outcome
  from historical_predictions
  where outcome is not null
   and (${sport}::text is null or sport=${sport})
   and (${market}::text is null or market_key=${market})
  order by occurred_at desc
  limit 10000
 `;
 return Response.json({source:'database',models:rollingModelPerformance(rows as any)});
}
