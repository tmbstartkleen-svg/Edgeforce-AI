import{t as e}from"./db-9LtqYd6N.js";import{t}from"./players-DSRvNqBp.js";async function n(n,{params:r}){let{id:i}=await r,a=e();if(!a){let e=t.find(e=>e.id===i);return Response.json({source:`demo`,player:e||null,history:[]})}let o=await a`select * from athletes where id=${i} limit 1`,s=await a`
    select event_id,stat_date,stats,source
    from player_game_stats where athlete_id=${i}
    order by stat_date desc limit 50
  `,c=await a`
    select as_of,features,source_window
    from player_features where athlete_id=${i}
    order by as_of desc limit 20
  `;return Response.json({source:`database`,player:o[0]||null,history:s,features:c})}export{n as GET};