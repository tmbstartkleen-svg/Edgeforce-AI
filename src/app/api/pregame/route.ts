import {db} from '@/lib/db';

export const dynamic='force-dynamic';

export async function GET(){
 const sql=db();
 if(!sql)return Response.json({configured:false,changes:[],reviewCount:0},{headers:{'Cache-Control':'no-store'}});

 const changes=await sql`
   select signature as id,event_id as "eventId",market_id as "marketId",market_key as "marketKey",selection_key as selection,
     sport,severity,reasons,previous_simulation_probability::float as "previousSimulationProbability",
     current_simulation_probability::float as "currentSimulationProbability",detected_at as "detectedAt"
   from pregame_change_events
   where detected_at >= now()-interval '24 hours'
   order by detected_at desc
   limit 50
 `;

 const reviewRows=await sql`
   select count(*)::int as count
   from weekly_parlay_legs
   where needs_review=true and result='pending'
 `;

 return Response.json({
   configured:true,
   changes,
   reviewCount:Number(reviewRows[0]?.count||0),
   generatedAt:new Date().toISOString()
 },{headers:{'Cache-Control':'no-store'}});
}
