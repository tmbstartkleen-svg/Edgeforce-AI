import {db} from '@/lib/db';
import {summarizeBacktest,walkForward} from '@/lib/backtest';

export const dynamic='force-dynamic';

export async function GET(req:Request){
 const {searchParams}=new URL(req.url);
 const sport=searchParams.get('sport');
 const market=searchParams.get('market');
 const model=searchParams.get('model');
 const limit=Math.min(20000,Math.max(50,Number(searchParams.get('limit')||5000)));
 const trainSize=Math.max(25,Number(searchParams.get('train')||100));
 const testSize=Math.max(10,Number(searchParams.get('test')||25));
 const sql=db();
 if(!sql)return Response.json({source:'none',summary:summarizeBacktest([]),folds:[],rows:0},{headers:{'Cache-Control':'no-store'}});
 const rows=await sql`
  select occurred_at as "occurredAt",sport,market_key as "marketKey",model_name as "modelName",
   predicted_probability::float as predicted,offered_odds as odds,closing_odds as "closingOdds",outcome
  from historical_predictions
  where outcome is not null
   and (${sport}::text is null or sport=${sport})
   and (${market}::text is null or market_key=${market})
   and (${model}::text is null or model_name=${model})
  order by occurred_at asc
  limit ${limit}
 `;
 const history=rows as any[];
 return Response.json({
  source:'database',
  filters:{sport,market,model,limit,trainSize,testSize},
  rows:history.length,
  summary:summarizeBacktest(history),
  folds:walkForward(history,trainSize,testSize)
 },{headers:{'Cache-Control':'no-store'}});
}
