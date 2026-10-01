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
        (select count(*)::int from model_runs) as model_runs,
        (select count(*)::int from bet_results) as bet_results
    `;
    return Response.json({configured:true,ok:true,counts:row},{headers:{'Cache-Control':'no-store'}});
  }catch(error){
    return Response.json({configured:true,ok:false,counts:{},error:error instanceof Error?error.message:'db stats error'},{status:200});
  }
}
