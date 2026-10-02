import {db} from '@/lib/db';
import {getWeeklyDraft} from '@/lib/weeklyBuilder';

export const dynamic='force-dynamic';

export async function GET(){
 const sql=db();
 if(!sql)return Response.json({
   configured:false,changes:[],reviewCount:0,
   weekly:{configured:false,week:'',legs:[],combinedProbability:null,decisionCounts:{KEEP:0,WATCH:0,REPLACE_CANDIDATE:0}}
 },{headers:{'Cache-Control':'no-store'}});

 const [changes,weekly]=await Promise.all([
   sql`
     select signature as id,event_id as "eventId",market_id as "marketId",market_key as "marketKey",selection_key as selection,
       sport,severity,reasons,previous_simulation_probability::float as "previousSimulationProbability",
       current_simulation_probability::float as "currentSimulationProbability",detected_at as "detectedAt"
     from pregame_change_events
     where detected_at >= now()-interval '24 hours'
     order by detected_at desc
     limit 50
   `,
   getWeeklyDraft()
 ]);

 const reviewCount=(weekly.legs||[]).filter(x=>x.needsReview).length;

 return Response.json({
   configured:true,
   changes,
   reviewCount,
   weekly,
   generatedAt:new Date().toISOString()
 },{headers:{'Cache-Control':'no-store'}});
}
