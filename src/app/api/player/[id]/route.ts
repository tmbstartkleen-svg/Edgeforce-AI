import {db} from '@/lib/db';
import {demoPlayers} from '@/lib/players';

export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const sql=db();
  if(!sql){
    const player=demoPlayers.find(x=>x.id===id);
    return Response.json({source:'demo',player:player||null,history:[]});
  }
  const players=await sql`select * from athletes where id=${id} limit 1`;
  const history=await sql`
    select event_id,stat_date,stats,source
    from player_game_stats where athlete_id=${id}
    order by stat_date desc limit 50
  `;
  const features=await sql`
    select as_of,features,source_window
    from player_features where athlete_id=${id}
    order by as_of desc limit 20
  `;
  return Response.json({source:'database',player:players[0]||null,history,features});
}
