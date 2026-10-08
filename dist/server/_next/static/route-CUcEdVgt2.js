import{t as e}from"./db-9LtqYd6N.js";import{i as t,r as n}from"./marketMovementLearning-Ce-G0UXL.js";async function r(r,{params:i}){let{id:a}=await i,{searchParams:o}=new URL(r.url),s=o.get(`market`),c=o.get(`selection`),l=e();if(!l)return Response.json({source:`none`,points:[]});let u=(await l`
  select sport,home_team_id as home,away_team_id as away,start_time as "startTime"
  from events where id=${a} limit 1
 `)[0];if(!u)return Response.json({source:`database`,points:[]});let d=await l`
  select ms.event_id as "eventId",ms.market_key as "marketKey",ms.selection_key as "selectionKey",
   ms.american_odds as odds,coalesce(ms.no_vig_probability,ms.implied_probability,0.5)::float as "impliedProbability",
   ms.pulled_at as "pulledAt"
  from market_snapshots ms join events e on e.id=ms.event_id
  where lower(e.sport)=lower(${String(u.sport)})
   and lower(coalesce(e.home_team_id,''))=lower(${String(u.home||``)})
   and lower(coalesce(e.away_team_id,''))=lower(${String(u.away||``)})
   and abs(extract(epoch from (e.start_time-${new Date(u.startTime).toISOString()}::timestamptz)))<=600
   and ms.pulled_at<=least(e.start_time,now())
  order by ms.pulled_at asc
  limit 2000
 `,f=s?n(s):null,p=s&&c?t(c,s):null,m=d.filter(e=>!(f&&n(String(e.marketKey))!==f||p&&t(String(e.selectionKey),String(e.marketKey))!==p)).map(e=>({...e,point:String(e.selectionKey).match(/(?:^|\s)([+-]?\d+(?:\.\d+)?)\s*$/)?.[1]??null}));return Response.json({source:`database`,canonical:!0,points:m},{headers:{"Cache-Control":`no-store`}})}export{r as GET};