import{t as e}from"./db-9LtqYd6N.js";import{t}from"./players-DSRvNqBp.js";var n=`force-dynamic`;async function r(n){let r=new URL(n.url),i=Math.max(1,Math.min(500,Number(r.searchParams.get(`limit`)||100))),a=String(r.searchParams.get(`sport`)||``).trim(),o=e();if(!o)return Response.json({source:`demo`,count:t.length,players:t});let s=a?await o`
    select a.id,a.name,a.sport,a.team,a.position,a.active,a.last_seen_at as "lastSeenAt",
     (select count(*)::int from player_game_stats pgs where pgs.athlete_id=a.id) as games,
     (select max(stat_date) from player_game_stats pgs where pgs.athlete_id=a.id) as "lastGameAt"
    from athletes a
    where lower(a.sport)=lower(${a})
    order by a.last_seen_at desc
    limit ${i}
   `:await o`
    select a.id,a.name,a.sport,a.team,a.position,a.active,a.last_seen_at as "lastSeenAt",
     (select count(*)::int from player_game_stats pgs where pgs.athlete_id=a.id) as games,
     (select max(stat_date) from player_game_stats pgs where pgs.athlete_id=a.id) as "lastGameAt"
    from athletes a
    order by a.last_seen_at desc
    limit ${i}
   `;return Response.json({source:`database`,count:s.length,sport:a||null,players:s},{headers:{"Cache-Control":`no-store`}})}export{r as GET,n as dynamic};