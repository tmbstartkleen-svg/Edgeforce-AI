import{t as e}from"./db-9LtqYd6N.js";import{r as t}from"./playerWarehouse-BjX_GuwQ.js";var n=e=>e&&typeof e==`object`&&!Array.isArray(e)?e:{},r=e=>{if(Array.isArray(e))return e;let t=n(e);for(let e of[`data`,`results`,`events`,`rows`,`items`])if(Array.isArray(t[e]))return t[e];return[]},i=e=>{let t=typeof e==`number`?e:Number(e);return Number.isFinite(t)?t:void 0},a=(e,t=0,n=1)=>Math.max(t,Math.min(n,e)),o=e=>e.toLowerCase().replace(/[^a-z0-9]+/g,``)||`*`,s=e=>t(e),c=e=>e.length?e.reduce((e,t)=>e+t,0)/e.length:0;function l(e){let t=e.toLowerCase();return/out|inactive|ir|injured reserve|suspended/.test(t)?0:/doubtful/.test(t)?.25:/questionable|game[- ]?time/.test(t)?.55:/probable/.test(t)?.85:/active|available|healthy/.test(t)?1:.7}function u(e){return r(e).map(e=>{let t=n(e),r=n(t.player||t.athlete),o=String(t.playerName||t.player_name||t.athleteName||t.athlete_name||r.name||``).trim(),s=String(t.team||t.teamName||t.team_name||r.team||``).trim()||void 0,c=String(t.status||t.injuryStatus||t.injury_status||``).trim()||void 0;return{name:o,team:s,status:c,availability:a(i(t.availability??t.availabilityProbability??t.availability_probability)??l(c||``))}}).filter(e=>e.name&&e.availability<.99)}function d(e){let t=new Map;for(let n of e){if(!n.athleteId||!n.sport||!n.team)continue;let e=t.get(n.athleteId)||[];e.push(n),t.set(n.athleteId,e)}let n=[];for(let[e,r]of t){let t=r[0].sport,l=s(r[0].team),u=o(String(r[0].position||`*`)),d=r.filter(e=>e.starter===!0).length,f=r.filter(e=>e.starter!==null&&e.starter!==void 0).length,p=c(r.map(e=>i(e.minutes)).filter(e=>e!==void 0)),m=c(r.map(e=>i(e.usage)).filter(e=>e!==void 0)),h=f?d/f:0;n.push({athleteId:e,sport:t,teamKey:l,positionKey:u,games:r.length,starts:d,starterEvidenceGames:f,starterRate:h,averageMinutes:p,averageUsage:m,roleScore:0,depthRank:99,confidence:a(r.length/20)*(.65+.35*a(f/Math.max(1,r.length)))})}let r=new Map;for(let e of n){let t=[e.sport,e.teamKey,e.positionKey].join(`|`),n=r.get(t)||[];n.push(e),r.set(t,n)}for(let e of r.values()){let t=Math.max(1,...e.map(e=>e.averageMinutes)),n=Math.max(.01,...e.map(e=>e.averageUsage));for(let r of e){let e=a(r.averageMinutes/t),i=a(r.averageUsage/n);r.roleScore=a(r.starterRate*.55+e*.3+i*.15)}e.sort((e,t)=>t.roleScore-e.roleScore),e.forEach((e,t)=>e.depthRank=t+1)}return n}async function f(){let t=e();if(!t)return{configured:!1,rowsRead:0,profilesWritten:0,teamsProfiled:0};let n=await t`insert into depth_chart_runs(model_version) values(${process.env.MODEL_VERSION||`edgeforce-v61`}) returning id`,r=Number(n[0]?.id||0),a=await t`
  select pgs.athlete_id as "athleteId",a.sport,coalesce(pgs.team,a.team) as team,a.position,
         pgs.starter,pgs.minutes::float as minutes,pgs.usage_rate::float as usage
  from player_game_stats pgs join athletes a on a.id=pgs.athlete_id
  where pgs.stat_date>now()-interval '730 days' and coalesce(pgs.team,a.team) is not null
  order by pgs.stat_date desc limit 40000
 `,o=d(a.map(e=>({athleteId:String(e.athleteId),sport:String(e.sport),team:String(e.team),position:e.position?String(e.position):null,starter:e.starter===null||e.starter===void 0?null:!!e.starter,minutes:i(e.minutes),usage:i(e.usage)}))),s=0;for(let e of o)await t`
   insert into depth_chart_profiles(
    athlete_id,sport,team_key,position_key,games,starts,starter_evidence_games,starter_rate,average_minutes,average_usage,role_score,depth_rank,confidence,updated_at,metadata
   ) values(
    ${e.athleteId},${e.sport},${e.teamKey},${e.positionKey},${e.games},${e.starts},${e.starterEvidenceGames},${e.starterRate},
    ${e.averageMinutes},${e.averageUsage},${e.roleScore},${e.depthRank},${e.confidence},now(),
    ${t.json({lookbackDays:730,explicitStarterSupport:e.starterEvidenceGames>0})}
   )
   on conflict (athlete_id) do update set
    sport=excluded.sport,team_key=excluded.team_key,position_key=excluded.position_key,games=excluded.games,
    starts=excluded.starts,starter_evidence_games=excluded.starter_evidence_games,starter_rate=excluded.starter_rate,average_minutes=excluded.average_minutes,
    average_usage=excluded.average_usage,role_score=excluded.role_score,depth_rank=excluded.depth_rank,
    confidence=excluded.confidence,updated_at=now(),metadata=excluded.metadata
  `,s++;let c=new Set(o.map(e=>e.sport+`|`+e.teamKey)).size;return r&&await t`
  update depth_chart_runs set rows_read=${a.length},profiles_written=${s},teams_profiled=${c},
  completed_at=now(),metadata=${t.json({lookbackDays:730})} where id=${r}
 `,{configured:!0,rowsRead:a.length,profilesWritten:s,teamsProfiled:c}}async function p(){let t=e();return t?u((await t`select payload from injury_context_snapshots where expires_at>now() order by observed_at desc limit 1`)[0]?.payload):[]}async function m(n){let r=e(),i=n.filter(e=>e.playerContext?.name);if(!r||!i.length)return{markets:n,matched:0,profiles:0,promotions:0};let c=await r`
  select id,name,normalized_name as "normalizedName",sport,team,position
  from athletes where normalized_name in ${r([...new Set(i.map(e=>t(e.playerContext.name)).filter(Boolean))])}
 `;if(!c.length)return{markets:n,matched:0,profiles:0,promotions:0};let l=new Map(c.map(e=>[String(e.normalizedName),e])),u=await r`
  select athlete_id as "athleteId",sport,team_key as "teamKey",position_key as "positionKey",
         games,starts,starter_evidence_games as "starterEvidenceGames",starter_rate::float as "starterRate",average_minutes::float as "averageMinutes",
         average_usage::float as "averageUsage",role_score::float as "roleScore",depth_rank as "depthRank",
         confidence::float as confidence
  from depth_chart_profiles where athlete_id in ${r(c.map(e=>String(e.id)))}
 `,d=new Map(u.map(e=>[String(e.athleteId),e])),f=await p(),m=[...new Set(f.map(e=>t(e.name)).filter(Boolean))],h=m.length?await r`
  select id,normalized_name as "normalizedName",sport,team,position from athletes where normalized_name in ${r(m)}
 `:[],g=new Map,_=new Map(f.map(e=>[t(e.name),e]));for(let e of h){let t=_.get(String(e.normalizedName));t&&g.set(String(e.id),t)}let v=[...g.keys()],y=v.length?await r`
  select athlete_id as "athleteId",sport,team_key as "teamKey",position_key as "positionKey",
         starter_evidence_games as "starterEvidenceGames",starter_rate::float as "starterRate",role_score::float as "roleScore",depth_rank as "depthRank",confidence::float as confidence
  from depth_chart_profiles where athlete_id in ${r(v)}
 `:[],b=new Map(y.map(e=>[String(e.athleteId),e])),x=0,S=0;return{markets:n.map(e=>{let n=e.playerContext;if(!n?.name)return e;let r=l.get(t(n.name));if(!r)return e;let i=d.get(String(r.id));if(!i&&n.starter===void 0)return e;let c=n.starter,u=Number(i?.starterEvidenceGames||0)>0?Number(i?.starterRate||0):Number(i?.roleScore??.5),f=c===!0?1:c===!1?0:a(u),p=0,m;if(c===void 0){for(let[e,t]of g){let c=b.get(e);if(!c)continue;let l=String(c.teamKey)===s(String(r.team||n.team||``)),u=String(c.positionKey)===o(String(r.position||`*`)),d=Number(c.starterEvidenceGames||0)>0?Number(c.starterRate||0):Number(c.roleScore||0);if(!l||!u||d<.35)continue;let f=a(1-(Math.max(1,Number(i?.depthRank||99))-1)*.18),h=(1-t.availability)*f*a(d)*.85;h>p&&(p=h,m=e)}p>0&&(f=a(f+(1-f)*p),S++)}let h=a(Number(i?.confidence||.45)),_=a(u),v=f-_,y={...e.sportFeatures||{},lineupStarterProbability:f,lineupRoleConfidence:h,lineupPromotionScore:p,lineupDepthRank:Number(i?.depthRank||99),lineupRoleScore:Number(i?.roleScore||f),lineupStarterDelta:v},C=Math.max(.82,Math.min(1.18,1+v*.16*h)),w=n.projection===void 0?void 0:n.projection*C,T=[...e.contextProvenance||[],{source:`starting-lineup`,providerId:`edgeforce-v66-lineup-engine`,field:`player.lineup-role`,observedAt:new Date().toISOString(),confidence:.72+.25*h,status:c===void 0?`CACHED`:`LIVE`,detail:{starterProbability:f,baselineStarterProbability:_,roleDelta:v,liveStarter:c??null,depthRank:Number(i?.depthRank||99),promotionScore:p,displacedBy:m||null}}];return x++,{...e,sportFeatures:y,playerContext:{...n,...w===void 0?{}:{projection:w},starter:c},contextSources:[...new Set([...e.contextSources||[],`starting-lineup`])],contextProvenance:T}}),matched:x,profiles:u.length,promotions:S}}async function h(n){let r=e();if(!r)return 0;let i=n.filter(e=>e.playerContext?.name&&(e.playerContext?.starter!==void 0||e.playerContext?.availability!==void 0||e.playerContext?.status));if(!i.length)return 0;let a=await r`select id,normalized_name as "normalizedName" from athletes where normalized_name in ${r([...new Set(i.map(e=>t(e.playerContext.name)))])}`,o=new Map(a.map(e=>[String(e.normalizedName),String(e.id)])),c=0;for(let e of i){let n=e.playerContext,i=o.get(t(n.name)),a=s(n.team||``);await r`
   insert into live_lineup_snapshots(athlete_id,player_name,sport,team_key,event_id,starter,availability,status,source,observed_at,metadata)
   values(${i||null},${n.name},${e.sport},${a||null},${e.id.split(`:`)[0]},${n.starter??null},${n.availability??null},${n.status??null},
          'edgeforce-context',now(),${r.json({contextSources:e.contextSources||[]})})
  `,c++}return c}async function g(){let t=e();if(!t)return{configured:!1,totalProfiles:0,teams:0,likelyStarters:0,liveSnapshots:0,top:[]};let[n,r]=await Promise.all([t`
   select
    (select count(*)::int from depth_chart_profiles) as "totalProfiles",
    (select count(distinct sport||'|'||team_key)::int from depth_chart_profiles) as teams,
    (select count(*)::int from depth_chart_profiles where starter_rate>=.5 or role_score>=.72) as "likelyStarters",
    (select count(*)::int from live_lineup_snapshots where observed_at>now()-interval '24 hours') as "liveSnapshots"
  `,t`
   select a.name as "playerName",d.sport,d.team_key as "teamKey",d.position_key as "positionKey",d.games,d.starts,d.starter_evidence_games as "starterEvidenceGames",
          d.starter_rate::float as "starterRate",d.average_minutes::float as "averageMinutes",
          d.average_usage::float as "averageUsage",d.role_score::float as "roleScore",d.depth_rank as "depthRank",
          d.confidence::float as confidence
   from depth_chart_profiles d join athletes a on a.id=d.athlete_id
   order by d.role_score desc,d.confidence desc limit 30
  `]),i=n[0]||{};return{configured:!0,totalProfiles:Number(i.totalProfiles||0),teams:Number(i.teams||0),likelyStarters:Number(i.likelyStarters||0),liveSnapshots:Number(i.liveSnapshots||0),top:r}}export{h as a,f as i,m as n,g as r,d as t};