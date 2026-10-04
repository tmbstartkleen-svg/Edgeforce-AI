import {db} from '@/lib/db';

export const dynamic='force-dynamic';

export async function GET(){
  const sql=db();
  if(!sql)return Response.json({configured:false,ok:false,counts:{}});
  try{
    const [row]=await sql`
      select
        (select count(*)::int from athletes) as athletes,
        (select count(*)::int from player_game_stats) as player_game_stats,
        (select count(*)::int from market_snapshots) as market_snapshots,
        (select count(*)::int from market_consensus_snapshots) as market_consensus_snapshots,
        (select count(*)::int from model_runs) as model_runs,
        (select count(*)::int from bet_results) as bet_results,
        (select count(*)::int from automation_runs) as automation_runs,
        (select count(*)::int from production_certifications) as production_certifications,
        (select count(*)::int from model_governance_runs) as model_governance_runs,
        (select count(*)::int from model_governance_snapshots) as model_governance_snapshots,
        (select count(*)::int from validation_runs) as validation_runs,
        (select count(*)::int from validation_snapshots) as validation_snapshots,
        (select count(*)::int from prediction_positions) as prediction_positions,
        (select count(*)::int from prediction_positions where status='open') as open_prediction_positions,
        (select count(*)::int from prediction_position_marks) as prediction_position_marks,
        (select count(*)::int from bet_slips) as bet_slips,
        (select count(*)::int from bet_slips where result='open') as open_wagers,
        (select count(*)::int from bet_slips where result in ('win','loss','push')) as settled_wagers
    `;
    return Response.json({configured:true,ok:true,counts:row},{headers:{'Cache-Control':'no-store'}});
  }catch(error){
    return Response.json({configured:true,ok:false,counts:{},error:error instanceof Error?error.message:'db stats error'},{status:200});
  }
}
