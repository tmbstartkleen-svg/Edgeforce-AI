import {db} from '@/lib/db';
import {calibrationSummary} from '@/lib/modelCalibration';

export async function GET(req:Request){
 const {searchParams}=new URL(req.url);
 const sport=searchParams.get('sport');
 const market=searchParams.get('market');
 const model=searchParams.get('model');
 const sql=db();
 if(!sql)return Response.json({source:'none',profiles:[]});
 const rows=await sql`
  select occurred_at as "occurredAt",sport,market_key as "marketKey",model_name as "modelName",
   predicted_probability::float as predicted,offered_odds as odds,closing_odds as "closingOdds",outcome
  from historical_predictions
  where outcome is not null
   and (${sport}::text is null or sport=${sport})
   and (${market}::text is null or market_key=${market})
   and (${model}::text is null or model_name=${model})
  order by occurred_at desc
  limit 10000
 `;
 const groups=new Map<string,any[]>();
 for(const row of rows as any[]){const key=[row.sport,row.marketKey,row.modelName].join('|');const arr=groups.get(key)||[];arr.push(row);groups.set(key,arr);}
 const profiles=[...groups.entries()].map(([key,group])=>{const [sportName,marketKey,modelName]=key.split('|');return {sport:sportName,marketKey,modelName,...calibrationSummary(group as any)};});
 return Response.json({source:'database',profiles});
}
