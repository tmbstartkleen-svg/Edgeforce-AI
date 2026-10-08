import{t as e}from"./db-9LtqYd6N.js";import{r as t}from"./playerWarehouse-BjX_GuwQ.js";var n=e=>e&&typeof e==`object`&&!Array.isArray(e)?e:{},r=e=>{let t=typeof e==`number`?e:Number(e);return Number.isFinite(t)?t:void 0},i=(e,t=-1,n=1)=>Math.max(t,Math.min(n,e)),a=e=>e.toLowerCase().replace(/[^a-z0-9]+/g,``),o=e=>t(e),s=e=>e.length?e.reduce((e,t)=>e+t,0)/e.length:0,c=e=>{if(e.length<2)return 0;let t=s(e);return Math.sqrt(e.reduce((e,n)=>e+(n-t)**2,0)/e.length)},l=e=>{let t=(e.market+` `+e.selection).toLowerCase();return t.includes(`under`)?-1:t.includes(`over`)?1:0},u=e=>{if(e.playerContext?.statKey)return a(e.playerContext.statKey);let t=(e.market+` `+e.selection).toLowerCase();for(let[e,n]of[[/passing\s*yards?/,`passingyards`],[/passing\s*(tds?|touchdowns?)/,`passingtds`],[/rushing\s*yards?/,`rushingyards`],[/receiving\s*yards?/,`receivingyards`],[/receptions?/,`receptions`],[/targets?/,`targets`],[/carries/,`carries`],[/pitch(?:er|ing).*strikeouts?|strikeouts?/,`strikeouts`],[/total\s*bases?/,`totalbases`],[/home\s*runs?/,`homeruns`],[/\brbi\b/,`rbi`],[/\bhits?\b/,`hits`],[/shots?\s*on\s*goal/,`shotsongoal`],[/\bsaves?\b/,`saves`],[/\bgoals?\b/,`goals`],[/\bpoints?\b/,`points`],[/rebounds?/,`rebounds`],[/assists?/,`assists`],[/three[- ]?pointers?|3[- ]?pointers?|threes?/,`threepointers`],[/\baces?\b/,`aces`],[/double\s*faults?/,`doublefaults`],[/games?\s*won/,`gameswon`],[/sets?\s*won/,`setswon`]])if(e.test(t))return n;return``};function d(e){let t=[];for(let[n,i]of Object.entries(e)){let e=r(i),o=a(n);!o||e===void 0||Math.abs(e)>1e6||t.push([o,e])}return t}function f(e){let t=[];for(let n of e){let e=o(n.opponent);if(!n.athleteId||!e)continue;let r=a(String(n.position||``))||`*`;for(let[i,a]of d(n.stats))t.push({athleteId:n.athleteId,sport:n.sport,opponentKey:e,opponentName:n.opponent,positionKey:r,statKey:i,value:a})}return t}function p(e){let t=new Map;for(let n of e){let e=[n.athleteId,n.sport,n.statKey].join(`|`),r=t.get(e)||[];r.push(n.value),t.set(e,r)}let n=new Map;for(let[e,r]of t)n.set(e,{sampleSize:r.length,mean:s(r),stdDev:c(r)});return n}function m(e,t){let n=Math.max(t.stdDev,Math.abs(t.mean)*.18,1);return i((e-t.mean)/n,-2,2)}function h(e){let t=f(e),n=p(t),r=new Map,a=new Map;for(let e of t){let t=n.get([e.athleteId,e.sport,e.statKey].join(`|`));if(!t||t.sampleSize<3)continue;let i=[e.sport,e.statKey].join(`|`),o=r.get(i)||[];o.push(e.value),r.set(i,o);let s=m(e.value,t);for(let t of[...new Set([e.positionKey,`*`])]){let n=[e.sport,e.opponentKey,t,e.statKey].join(`|`),r=a.get(n)||{sport:e.sport,opponentKey:e.opponentKey,opponentName:e.opponentName,positionKey:t,statKey:e.statKey,values:[],residuals:[],athletes:new Set};r.values.push(e.value),r.residuals.push(s),r.athletes.add(e.athleteId),a.set(n,r)}}let o=[];for(let e of a.values()){let t=e.values.length;if(t<(e.positionKey===`*`?12:6))continue;let n=r.get([e.sport,e.statKey].join(`|`))||[];if(n.length<20)continue;let a=e.athletes.size,l=e.positionKey===`*`?60:40,u=e.positionKey===`*`?8:5,d=i(t/l,0,1),f=.65+.35*i(a/u,0,1),p=s(e.values),m=s(n);o.push({sport:e.sport,opponentKey:e.opponentKey,opponentName:e.opponentName,positionKey:e.positionKey,statKey:e.statKey,sampleSize:t,athleteCount:a,meanAllowed:p,leagueMean:m,relativeSignal:i(s(e.residuals)),volatility:i(c(e.values)/Math.max(Math.abs(p),1),0,1),confidence:i(d*f,0,1)})}return o}function g(e){let t=f(e),n=p(t),r=new Map;for(let e of t){let t=[e.athleteId,e.sport,e.opponentKey,e.statKey].join(`|`),n=r.get(t)||{athleteId:e.athleteId,sport:e.sport,opponentKey:e.opponentKey,opponentName:e.opponentName,statKey:e.statKey,values:[]};n.values.push(e.value),r.set(t,n)}let a=[];for(let e of r.values()){if(e.values.length<2)continue;let t=n.get([e.athleteId,e.sport,e.statKey].join(`|`));if(!t||t.sampleSize<5)continue;let r=s(e.values),o=Math.max(t.stdDev,Math.abs(t.mean)*.18,1),c=i(e.values.length/8,0,1),l=.6+.4*i(t.sampleSize/20,0,1);a.push({athleteId:e.athleteId,sport:e.sport,opponentKey:e.opponentKey,opponentName:e.opponentName,statKey:e.statKey,sampleSize:e.values.length,baselineMean:t.mean,opponentMean:r,relativeSignal:i((r-t.mean)/o),confidence:i(c*l,0,1)})}return a}async function _(){let t=e();if(!t)return{configured:!1,rowsRead:0,profilesWritten:0,qualifiedProfiles:0,playerProfilesWritten:0,qualifiedPlayerProfiles:0};let r=await t`
  insert into opponent_matchup_runs(model_version)
  values(${process.env.MODEL_VERSION||`edgeforce-v61`})
  returning id
 `,i=Number(r[0]?.id||0),a=await t`
  select pgs.athlete_id as "athleteId",a.sport,a.position,pgs.opponent,pgs.stat_date as "statDate",pgs.stats
  from player_game_stats pgs join athletes a on a.id=pgs.athlete_id
  where pgs.opponent is not null and pgs.stat_date>now()-interval '730 days'
  order by pgs.stat_date desc limit 25000
 `,o=a.map(e=>({athleteId:String(e.athleteId),sport:String(e.sport),position:e.position?String(e.position):null,opponent:String(e.opponent),statDate:new Date(e.statDate).toISOString(),stats:n(e.stats)})),s=h(o),c=g(o),l=0,u=0,d=0,f=0;for(let e of s)e.confidence>=.2&&u++,await t`
   insert into opponent_matchup_profiles(
    sport,opponent_key,opponent_name,position_key,stat_key,sample_size,athlete_count,
    mean_allowed,league_mean,relative_signal,volatility,confidence,updated_at,metadata
   ) values(
    ${e.sport},${e.opponentKey},${e.opponentName},${e.positionKey},${e.statKey},${e.sampleSize},${e.athleteCount},
    ${e.meanAllowed},${e.leagueMean},${e.relativeSignal},${e.volatility},${e.confidence},now(),
    ${t.json({lookbackDays:730,positionSpecific:e.positionKey!==`*`,baselineAdjusted:!0})}
   )
   on conflict (sport,opponent_key,position_key,stat_key) do update set
    opponent_name=excluded.opponent_name,sample_size=excluded.sample_size,athlete_count=excluded.athlete_count,
    mean_allowed=excluded.mean_allowed,league_mean=excluded.league_mean,relative_signal=excluded.relative_signal,
    volatility=excluded.volatility,confidence=excluded.confidence,updated_at=now(),metadata=excluded.metadata
  `,l++;for(let e of c)e.confidence>=.2&&f++,await t`
   insert into player_opponent_matchup_profiles(
    athlete_id,sport,opponent_key,opponent_name,stat_key,sample_size,
    baseline_mean,opponent_mean,relative_signal,confidence,updated_at,metadata
   ) values(
    ${e.athleteId},${e.sport},${e.opponentKey},${e.opponentName},${e.statKey},${e.sampleSize},
    ${e.baselineMean},${e.opponentMean},${e.relativeSignal},${e.confidence},now(),
    ${t.json({lookbackDays:730,minOpponentGames:2,baselineAdjusted:!0})}
   )
   on conflict (athlete_id,sport,opponent_key,stat_key) do update set
    opponent_name=excluded.opponent_name,sample_size=excluded.sample_size,baseline_mean=excluded.baseline_mean,
    opponent_mean=excluded.opponent_mean,relative_signal=excluded.relative_signal,
    confidence=excluded.confidence,updated_at=now(),metadata=excluded.metadata
  `,d++;return i&&await t`
  update opponent_matchup_runs
  set rows_read=${a.length},profiles_written=${l},qualified_profiles=${u},
      player_profiles_written=${d},qualified_player_profiles=${f},
      completed_at=now(),metadata=${t.json({lookbackDays:730,baselineAdjusted:!0})}
  where id=${i}
 `,{configured:!0,rowsRead:a.length,profilesWritten:l,qualifiedProfiles:u,playerProfilesWritten:d,qualifiedPlayerProfiles:f}}function v(e,t){return!!(e&&t&&o(e)===o(t))}function y(e,t){return t&&v(t,e.home)?e.away:t&&v(t,e.away)?e.home:``}async function b(n){let r=e(),s=n.filter(e=>e.playerContext?.name);if(!r||!s.length)return{markets:n,matched:0,profiles:0,playerProfiles:0};let c=await r`
  select id,normalized_name as "normalizedName",sport,team,position from athletes
  where normalized_name in ${r([...new Set(s.map(e=>t(e.playerContext.name)).filter(Boolean))])}
 `;if(!c.length)return{markets:n,matched:0,profiles:0,playerProfiles:0};let d=new Map(c.map(e=>[String(e.normalizedName),e])),f=[...new Set(s.map(e=>{let n=d.get(t(e.playerContext.name));return o(y(e,e.playerContext?.team||n?.team))}).filter(Boolean))],p=[...new Set(s.map(e=>e.sport))],m=[...new Set(c.map(e=>String(e.id)))];if(!f.length||!p.length)return{markets:n,matched:0,profiles:0,playerProfiles:0};let[h,g]=await Promise.all([r`
   select sport,opponent_key as "opponentKey",opponent_name as "opponentName",
          position_key as "positionKey",stat_key as "statKey",sample_size as "sampleSize",
          athlete_count as "athleteCount",mean_allowed::float as "meanAllowed",league_mean::float as "leagueMean",
          relative_signal::float as "relativeSignal",volatility::float as volatility,confidence::float as confidence
   from opponent_matchup_profiles
   where opponent_key in ${r(f)} and sport in ${r(p)}
  `,r`
   select athlete_id as "athleteId",sport,opponent_key as "opponentKey",opponent_name as "opponentName",
          stat_key as "statKey",sample_size as "sampleSize",baseline_mean::float as "baselineMean",
          opponent_mean::float as "opponentMean",relative_signal::float as "relativeSignal",confidence::float as confidence
   from player_opponent_matchup_profiles
   where athlete_id in ${r(m)} and opponent_key in ${r(f)} and sport in ${r(p)}
  `]),_=new Map;for(let e of h)_.set([e.sport,e.opponentKey,e.positionKey,e.statKey].join(`|`),e);let v=new Map;for(let e of g)v.set([e.athleteId,e.sport,e.opponentKey,e.statKey].join(`|`),e);let b=0;return{markets:n.map(e=>{let n=e.playerContext;if(!n?.name)return e;let r=d.get(t(n.name));if(!r)return e;let s=y(e,n.team||r.team),c=o(s),f=u(e);if(!c||!f)return e;let p=a(String(r.position||``))||`*`,m=_.get([e.sport,c,p,f].join(`|`)),h=_.get([e.sport,c,`*`,f].join(`|`)),g=v.get([String(r.id),e.sport,c,f].join(`|`)),x=i(Number(h?.confidence||0),0,1),S=i(Number(m?.confidence||0),0,1),C=!!(m&&S>=.1),w=!!(h&&x>=.1),T=i(Number(g?.confidence||0),0,1),E=!!(g&&T>=.15);if(!C&&!w&&!E)return e;let D=w?i(Number(h.relativeSignal||0)):0,O=C?i(Number(m.relativeSignal||0)):D,k=C?[{signal:D,confidence:x,weight:.35},{signal:O,confidence:S,weight:.65}]:[{signal:D,confidence:x,weight:1}],A=k.reduce((e,t)=>e+t.weight*t.confidence,0),j=A>0?i(k.reduce((e,t)=>e+t.signal*t.weight*t.confidence,0)/A):0,M=i(A,0,1),N=E?i(Number(g.relativeSignal||0)):0,P=l(e),F=i(Number((C?m:h)?.volatility||0),0,1),I={...e.sportFeatures||{},opponentDefenseTendency:D,opponentDefenseConfidence:x,positionMatchupStrength:O,positionMatchupConfidence:C?S:x,opponentMatchupSignal:j*P,opponentMatchupRaw:j,opponentMatchupConfidence:M,opponentMatchupVolatility:F,opponentMatchupSample:Number((C?m:h)?.sampleSize||0),playerVsOpponentAdjustment:N,playerVsOpponentSignal:N*P,playerVsOpponentConfidence:T,playerVsOpponentSample:Number(g?.sampleSize||0)},L=[...e.contextProvenance||[],{source:`opponent-matchup`,providerId:`edgeforce-opponent-learning`,field:`opponent.`+f+`.`+p+`.matchup-stack`,observedAt:new Date().toISOString(),confidence:.7+.27*Math.max(M,T),status:`CACHED`,detail:{opponent:s,positionKey:p,teamSignal:D,positionSignal:O,playerVsOpponentSignal:N,defenseConfidence:M,playerConfidence:T,defenseSample:Number((C?m:h)?.sampleSize||0),playerSample:Number(g?.sampleSize||0),baselineAdjusted:!0}}];return b++,{...e,sportFeatures:I,contextSources:[...new Set([...e.contextSources||[],`opponent-matchup`])],contextProvenance:L}}),matched:b,profiles:h.length,playerProfiles:g.length}}async function x(){let t=e();if(!t)return{configured:!1,totalProfiles:0,qualifiedProfiles:0,playerProfiles:0,qualifiedPlayerProfiles:0,opponents:0,top:[],topPlayers:[]};let[n,r,i]=await Promise.all([t`
   select
    (select count(*)::int from opponent_matchup_profiles) as "totalProfiles",
    (select count(*)::int from opponent_matchup_profiles where confidence>=.20) as "qualifiedProfiles",
    (select count(*)::int from player_opponent_matchup_profiles) as "playerProfiles",
    (select count(*)::int from player_opponent_matchup_profiles where confidence>=.20) as "qualifiedPlayerProfiles",
    (select count(distinct sport||'|'||opponent_key)::int from opponent_matchup_profiles) as opponents
  `,t`
   select sport,opponent_name as "opponentName",position_key as "positionKey",stat_key as "statKey",
          sample_size as "sampleSize",athlete_count as "athleteCount",mean_allowed::float as "meanAllowed",
          league_mean::float as "leagueMean",relative_signal::float as "relativeSignal",
          volatility::float as volatility,confidence::float as confidence
   from opponent_matchup_profiles
   where confidence>=.20
   order by abs(relative_signal)*confidence desc,sample_size desc
   limit 30
  `,t`
   select a.name as "playerName",p.sport,p.opponent_name as "opponentName",p.stat_key as "statKey",
          p.sample_size as "sampleSize",p.baseline_mean::float as "baselineMean",
          p.opponent_mean::float as "opponentMean",p.relative_signal::float as "relativeSignal",
          p.confidence::float as confidence
   from player_opponent_matchup_profiles p
   join athletes a on a.id=p.athlete_id
   where p.confidence>=.20
   order by abs(p.relative_signal)*p.confidence desc,p.sample_size desc
   limit 30
  `]),a=n[0]||{};return{configured:!0,totalProfiles:Number(a.totalProfiles||0),qualifiedProfiles:Number(a.qualifiedProfiles||0),playerProfiles:Number(a.playerProfiles||0),qualifiedPlayerProfiles:Number(a.qualifiedPlayerProfiles||0),opponents:Number(a.opponents||0),top:r,topPlayers:i}}export{_ as a,x as i,g as n,b as r,h as t};