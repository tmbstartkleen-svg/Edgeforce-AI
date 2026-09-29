import {db} from '@/lib/db';
import {rollingFeaturePack} from '@/lib/rollingFeatures';

export async function POST(req:Request){
 const body=await req.json().catch(()=>({}));
 const athleteId=body?.athleteId;
 const keys=Array.isArray(body?.keys)?body.keys:[];
 const window=Math.max(2,Number(body?.window)||5);
 if(!athleteId||!keys.length)return Response.json({error:'athleteId and keys are required'},{status:400});
 const sql=db();
 if(!sql)return Response.json({source:'none',features:{}});
 const rows=await sql`
  select stat_date as date, stats
  from player_game_stats
  where athlete_id=${athleteId}
  order by stat_date desc limit ${Math.max(10,window*4)}
 `;
 const features=rollingFeaturePack(rows as any,keys,window);
 return Response.json({source:'database',athleteId,window,features});
}
