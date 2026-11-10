import {db} from '@/lib/db';
import {normalizeStoredPlayerGames} from '@/lib/intelligence-core/player-streak-archive.mjs';
import {reviewPlayerStreakEvidence} from '@/lib/intelligence-core/player-streak-evidence.mjs';

export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
const supportedStats=new Set([
  'points','rebounds','assists','steals','blocks','turnovers','minutes',
  'threepointers','passingyards','passingtds','rushingyards','receivingyards',
  'receptions','targets','carries','hits','runs','rbi','homeruns',
  'totalbases','strikeouts','walks','pitchingstrikeouts',
  'shots','shotsongoal','saves','goals','aces','doublefaults','gameswon','setswon'
]);

/** Archived history research only. No provider calls, odds, wagers, database writes or bootstrap jobs. */
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const url=new URL(request.url);
  const stat=(url.searchParams.get('stat')??'').trim().toLowerCase().replaceAll('_','');
  const thresholdText=url.searchParams.get('threshold');
  const threshold=thresholdText===null?NaN:Number(thresholdText);
  const asOfText=url.searchParams.get('asOf');
  const asOf=asOfText?new Date(asOfText):new Date();
  if(!/^[a-zA-Z0-9:_-]{1,100}$/.test(id)||!supportedStats.has(stat)||
     !Number.isFinite(threshold)||threshold<0||threshold>10000||
     !Number.isFinite(asOf.getTime())||asOf.getTime()>Date.now()+60000){
    return Response.json({ok:false,error:'INVALID_STREAK_QUERY',required:'stat and numeric threshold; optional asOf'},{status:400,headers});
  }

  try{
    const sql=db();
    if(!sql)return Response.json({ok:false,status:'DATA_SOURCE_UNAVAILABLE',researchOnly:true},{status:503,headers});
    const athletes=await sql`select id,name,sport,team from athletes where id=${id} limit 1`;
    if(!athletes.length)return Response.json({ok:false,error:'PLAYER_NOT_FOUND'},{status:404,headers});

    // Only historical rows already in the warehouse. Do not silently mark a game
    // completed when there is no final-status evidence.
    const rows=await sql`
      select g.athlete_id as "athleteId",g.event_id as "eventId",
        g.stat_date as "statDate",g.stats,g.source,g.raw,
        (select e.status from events e
         where e.id=g.event_id or e.provider_event_id=g.event_id
         order by case when e.provider_event_id=g.event_id then 0 else 1 end
         limit 1) as "eventStatus"
      from player_game_stats g
      where g.athlete_id=${id} and g.stat_date<=${asOf.toISOString()}
      order by g.stat_date desc
      limit 100
    `;
    const archive=normalizeStoredPlayerGames(rows as unknown as Parameters<typeof normalizeStoredPlayerGames>[0],id);
    const review=reviewPlayerStreakEvidence({
      playerId:id,games:archive.games,stat,threshold,
      asOf:asOf.toISOString(),source:'ARCHIVED_PLAYER_GAME_STATS'
    });
    return Response.json({
      ok:true,generatedAt:new Date().toISOString(),player:athletes[0],
      dataSource:'LOCAL_ARCHIVE_READ_ONLY',
      sourceAuthenticated:false,independentForecastAvailable:false,
      researchOnly:true,archivedRows:archive.archivedRows,
      excludedArchiveRows:archive.omitted,
      caveat:'Historical observed frequencies are not modeled win probabilities. Constructed event links do not prove original source identity.',
      streak:review
    },{headers});
  }catch{
    return Response.json({ok:false,status:'READ_ONLY_DATA_UNAVAILABLE',researchOnly:true},{status:503,headers});
  }
}
