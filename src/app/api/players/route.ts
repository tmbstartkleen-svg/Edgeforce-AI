import {db} from '@/lib/db';
import {demoPlayers} from '@/lib/players';

export const dynamic='force-dynamic';

export async function GET(req:Request){
 const url=new URL(req.url);
 const limit=Math.max(1,Math.min(500,Number(url.searchParams.get('limit')||100)));
 const sport=String(url.searchParams.get('sport')||'').trim();
 const sql=db();

 if(!sql)return Response.json({source:'demo',count:demoPlayers.length,players:demoPlayers});

 const players=sport
  ?await sql`
    select a.id,a.name,a.sport,a.team,a.position,a.active,a.last_seen_at as "lastSeenAt",
     (select count(*)::int from player_game_stats pgs where pgs.athlete_id=a.id) as games,
     (select max(stat_date) from player_game_stats pgs where pgs.athlete_id=a.id) as "lastGameAt"
    from athletes a
    where lower(a.sport)=lower(${sport})
    order by a.last_seen_at desc
    limit ${limit}
   `
  :await sql`
    select a.id,a.name,a.sport,a.team,a.position,a.active,a.last_seen_at as "lastSeenAt",
     (select count(*)::int from player_game_stats pgs where pgs.athlete_id=a.id) as games,
     (select max(stat_date) from player_game_stats pgs where pgs.athlete_id=a.id) as "lastGameAt"
    from athletes a
    order by a.last_seen_at desc
    limit ${limit}
   `;

 return Response.json({
  source:'database',
  count:players.length,
  sport:sport||null,
  players
 },{headers:{'Cache-Control':'no-store'}});
}
