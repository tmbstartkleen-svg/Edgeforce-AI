import{t as e}from"./db-9LtqYd6N.js";import{i as t}from"./math-D6dV1ygj.js";function n(e,n){return t(n)-t(e)}function r(e){if(!e.length)return{sampleSize:0,avgClv:0,positiveRate:0,best:0,worst:0};let t=e.map(e=>n(e.offeredOdds,e.closingOdds));return{sampleSize:t.length,avgClv:t.reduce((e,t)=>e+t,0)/t.length,positiveRate:t.filter(e=>e>0).length/t.length,best:Math.max(...t),worst:Math.min(...t)}}async function i(){let t=e();if(!t)return Response.json({source:`none`,summary:r([]),bySport:[]});let n=await t`
  select sport,offered_odds as "offeredOdds",closing_odds as "closingOdds"
  from (
   select sport,offered_odds,closing_odds,occurred_at from historical_predictions where closing_odds is not null
   union all
   select coalesce(bl.sport,'Unknown') as sport,bl.offered_odds,bl.closing_odds,coalesce(bl.settled_at,bs.settled_at,bs.placed_at) as occurred_at
   from bet_legs bl join bet_slips bs on bs.id=bl.bet_slip_id
   where bl.offered_odds is not null and bl.closing_odds is not null
  ) x
  order by occurred_at desc
  limit 5000
 `,i=Object.entries(n.reduce((e,t)=>((e[t.sport]||=[]).push(t),e),{})).map(([e,t])=>({sport:e,...r(t)}));return Response.json({source:`database`,summary:r(n),bySport:i})}export{i as GET};