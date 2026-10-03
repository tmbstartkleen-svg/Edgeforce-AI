import {db} from '@/lib/db';
import {loadDynamicCalibrationProfiles} from '@/lib/regimeConfidence';

export const dynamic='force-dynamic';

export async function GET(){
 const profiles=await loadDynamicCalibrationProfiles();
 const sql=db();
 if(!sql)return Response.json({
  ok:true,source:'memory',profileCount:Object.keys(profiles).length,
  profiles:Object.values(profiles).slice(0,100),recent:[]
 },{headers:{'Cache-Control':'no-store'}});
 try{
  const recent=await sql`
   select event_id as "eventId",market_key as "marketKey",selection_key as "selection",
    simulation_probability::float as "simulationProbability",
    feature_snapshot->>'regime' as regime,
    (feature_snapshot->>'dynamicConfidence')::float as "dynamicConfidence",
    (feature_snapshot->>'uncertainty')::float as uncertainty,
    feature_snapshot->>'confidenceLabel' as "confidenceLabel",
    created_at as "createdAt"
   from model_runs
   where feature_snapshot ? 'dynamicConfidence'
   order by created_at desc
   limit 250
  `;
  const rows=recent as any[];
  const counts={stable:0,volatile:0,dislocated:0,thin:0,unknown:0,high:0,medium:0,low:0};
  for(const row of rows){
   const regime=String(row.regime||'UNKNOWN').toLowerCase();
   if(regime==='stable'||regime==='volatile'||regime==='dislocated'||regime==='thin'||regime==='unknown')counts[regime]++;
   const label=String(row.confidenceLabel||'LOW').toLowerCase();
   if(label==='high'||label==='medium'||label==='low')counts[label]++;
  }
  return Response.json({
   ok:true,source:'database',profileCount:Object.keys(profiles).length,
   profiles:Object.values(profiles).slice(0,100),counts,recent:rows
  },{headers:{'Cache-Control':'no-store'}});
 }catch(error){
  return Response.json({
   ok:true,source:'database',profileCount:Object.keys(profiles).length,
   profiles:Object.values(profiles).slice(0,100),recent:[],
   error:error instanceof Error?error.message:'regime query failed'
  },{headers:{'Cache-Control':'no-store'}});
 }
}
