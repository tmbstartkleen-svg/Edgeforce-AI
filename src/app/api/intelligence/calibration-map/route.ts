import {db} from '@/lib/db';

export async function GET(){
 const sql=db();
 if(!sql)return Response.json({source:'none',cells:[]});
 const rows=await sql`
  select sport,market_key as "marketKey",predicted_probability as p,outcome
  from historical_predictions
  where outcome is not null
  order by occurred_at desc
  limit 10000
 `;
 const buckets=new Map<string,{sport:string;marketKey:string;bucket:number;n:number;pred:number;actual:number}>();
 for(const r of rows as any[]){
  const bucket=Math.min(9,Math.max(0,Math.floor(Number(r.p)*10)));
  const key=[r.sport,r.marketKey,bucket].join('|');
  const cell=buckets.get(key)||{sport:r.sport,marketKey:r.marketKey,bucket,n:0,pred:0,actual:0};
  cell.n++;cell.pred+=Number(r.p);cell.actual+=Number(r.outcome);buckets.set(key,cell);
 }
 const cells=[...buckets.values()].map(c=>({...c,pred:c.pred/c.n,actual:c.actual/c.n,error:(c.pred-c.actual)/c.n}));
 return Response.json({source:'database',cells});
}
