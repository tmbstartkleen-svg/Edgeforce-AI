import{t as e}from"./db-9LtqYd6N.js";import{t}from"./rollingFeatures-9Vc5bgPo.js";async function n(n){let r=await n.json().catch(()=>({})),i=r?.athleteId,a=Array.isArray(r?.keys)?r.keys:[],o=Math.max(2,Number(r?.window)||5);if(!i||!a.length)return Response.json({error:`athleteId and keys are required`},{status:400});let s=e();if(!s)return Response.json({source:`none`,features:{}});let c=t(await s`
  select stat_date as date, stats
  from player_game_stats
  where athlete_id=${i}
  order by stat_date desc limit ${Math.max(10,o*4)}
 `,a,o);return Response.json({source:`database`,athleteId:i,window:o,features:c})}export{n as POST};