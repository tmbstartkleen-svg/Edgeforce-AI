import{t as e}from"./db-9LtqYd6N.js";import{r as t}from"./playerWarehouse-BjX_GuwQ.js";var n=e=>e&&typeof e==`object`&&!Array.isArray(e)?e:{},r=e=>{let t=typeof e==`number`?e:Number(e);return Number.isFinite(t)?t:void 0},i=(e,t=-1,n=1)=>Math.max(t,Math.min(n,e)),a=e=>e.toLowerCase().replace(/[^a-z0-9]+/g,``),o=e=>e.length?e.reduce((e,t)=>e+t,0)/e.length:0,s=e=>{if(e.length<2)return 0;let t=o(e);return Math.sqrt(e.reduce((e,n)=>e+(n-t)**2,0)/e.length)},c=(e,n)=>!!(e&&n&&t(e)===t(n));function l(e){let t=(e.playerContext?.statKey||e.market+` `+e.selection).toLowerCase();for(let[e,n]of[[/passing\s*yards?/,`passingyards`],[/passing\s*(tds?|touchdowns?)/,`passingtds`],[/rushing\s*yards?/,`rushingyards`],[/receiving\s*yards?/,`receivingyards`],[/receptions?/,`receptions`],[/targets?/,`targets`],[/carries/,`carries`],[/pitch(?:er|ing).*strikeouts?|strikeouts?/,`strikeouts`],[/total\s*bases?/,`totalbases`],[/home\s*runs?/,`homeruns`],[/\brbi\b/,`rbi`],[/\bhits?\b/,`hits`],[/shots?\s*on\s*goal/,`shotsongoal`],[/\bsaves?\b/,`saves`],[/\bgoals?\b/,`goals`],[/\bpoints?\b/,`points`],[/rebounds?/,`rebounds`],[/assists?/,`assists`],[/three[- ]?pointers?|3[- ]?pointers?|threes?/,`threepointers`],[/\baces?\b/,`aces`],[/double\s*faults?/,`doublefaults`],[/games?\s*won/,`gameswon`],[/sets?\s*won/,`setswon`]])if(e.test(t))return n;return a(e.playerContext?.statKey||``)}function u(e,t){let i=n(e.stats),o=r(i[t]);if(o!==void 0)return o;for(let[e,n]of Object.entries(i))if(a(e)===t){let e=r(n);if(e!==void 0)return e}}function d(e,n,a,l){let d=[...e].sort((e,t)=>new Date(t.statDate).getTime()-new Date(e.statDate).getTime()).map(e=>({g:e,v:u(e,n)})).filter(e=>e.v!==void 0);if(d.length<3)return null;let f=d.slice(0,20).map(e=>e.v),p=d.slice(0,5).map(e=>e.v),m=o(f),h=o(p),g=s(f),_=Math.max(g,Math.abs(m)*.12,1),v=a?d.filter(e=>String(e.g.homeAway||``).toLowerCase().startsWith(a.toLowerCase().slice(0,1))).map(e=>e.v):[],y=l?d.filter(e=>c(e.g.opponent,l)).map(e=>e.v):[],b=d.slice(0,20).map(e=>r(e.g.usageRate)).filter(e=>e!==void 0),x=d.slice(0,5).map(e=>r(e.g.usageRate)).filter(e=>e!==void 0),S=d.slice(0,10).map(e=>t(String(e.g.team||``))).filter(Boolean),C=S[0]||``,w=S.length&&C?S.filter(e=>e===C).length/S.length:0;return{sampleSize:f.length,recent5Mean:h,recent20Mean:m,playerForm:i((h-m)/_),playerVolatility:i(g/Math.max(Math.abs(m),1),0,1),playerHomeAway:v.length>=2?i((o(v)-m)/_):0,playerOpponent:y.length>=2?i((o(y)-m)/_):0,playerUsage:b.length>=3&&x.length?i((o(x)-o(b))/Math.max(Math.abs(o(b))*.18,.02)):0,playerRosterContinuity:i(w,0,1),playerSampleConfidence:i(f.length/20,0,1)}}function f(e,t){return t&&c(t,e.home)?{homeAway:`home`,opponent:e.away}:t&&c(t,e.away)?{homeAway:`away`,opponent:e.home}:{homeAway:void 0,opponent:void 0}}async function p(i){let a=e(),o=i.filter(e=>e.playerContext?.name);if(!a||!o.length)return{markets:i,matched:0,players:0,frames:[]};let s=await a`
  select id,name,normalized_name as "normalizedName",sport,team,position
  from athletes
  where normalized_name in ${a([...new Set(o.map(e=>t(e.playerContext.name)).filter(Boolean))])}
 `;if(!s.length)return{markets:i,matched:0,players:0,frames:[]};let c=await a`
  select athlete_id as "athleteId",stat_date as "statDate",opponent,home_away as "homeAway",team,
         minutes,usage_rate as "usageRate",stats
  from player_game_stats
  where athlete_id in ${a(s.map(e=>String(e.id)))}
  order by stat_date desc
  limit 3000
 `,u=new Map;for(let e of c){let t=u.get(String(e.athleteId))||[];t.push({statDate:new Date(e.statDate).toISOString(),opponent:e.opponent,homeAway:e.homeAway,team:e.team,minutes:r(e.minutes),usageRate:r(e.usageRate),stats:n(e.stats)}),u.set(String(e.athleteId),t)}let p=new Map(s.map(e=>[String(e.normalizedName),e])),m=[],h=0;return{markets:i.map(e=>{let n=e.playerContext;if(!n?.name)return e;let r=p.get(t(n.name));if(!r)return e;let i=l(e);if(!i)return e;let a=u.get(String(r.id))||[],o=f(e,n.team||r.team),s=d(a,i,o.homeAway,o.opponent);if(!s)return e;let c={...e.sportFeatures||{},...s},g=[...e.contextProvenance||[],{source:`player-feature-frame`,providerId:`edgeforce-player-frames`,field:`player.`+i+`.feature-frame`,observedAt:new Date().toISOString(),confidence:.72+.24*s.playerSampleConfidence,status:`CACHED`,detail:{athleteId:String(r.id),sampleSize:s.sampleSize,opponent:o.opponent,homeAway:o.homeAway}}],_={marketId:e.id,athleteId:String(r.id),playerName:n.name,sport:e.sport,eventId:e.id.split(`:`)[0],statKey:i,sampleSize:s.sampleSize,features:s,currentContext:{homeAway:o.homeAway,opponent:o.opponent,weather:e.sportFeatures?.weather??0,team:n.team||r.team||null}};return m.push(_),h++,{...e,sportFeatures:c,contextSources:[...new Set([...e.contextSources||[],`player-feature-frame`])],contextProvenance:g}}),matched:h,players:p.size,frames:m}}async function m(t){let n=e();if(!n)return 0;let r=await p(t),i=new Date(Math.floor(Date.now()/36e5)*36e5).toISOString(),a=0;for(let e of r.frames){let t=await n`
   insert into player_feature_frames(
    market_id,athlete_id,player_name,sport,event_id,stat_key,sample_size,features,current_context,model_version,observed_hour
   ) values(
    ${e.marketId},${e.athleteId},${e.playerName},${e.sport},${e.eventId},${e.statKey},
    ${e.sampleSize},${n.json(e.features)},${n.json(e.currentContext)},${process.env.MODEL_VERSION||`edgeforce-v61`},${i}
   )
   on conflict (market_id,player_name,observed_hour) do update set
    athlete_id=excluded.athlete_id,stat_key=excluded.stat_key,sample_size=excluded.sample_size,
    features=excluded.features,current_context=excluded.current_context,model_version=excluded.model_version
   returning id
  `;a+=t.length,await n`
   insert into player_learning_state(
    athlete_id,sport,stat_key,sample_size,form_signal,volatility,home_away_signal,opponent_signal,usage_signal,roster_continuity,last_observed_at,features
   ) values(
    ${e.athleteId},${e.sport},${e.statKey},${e.sampleSize},
    ${e.features.playerForm},${e.features.playerVolatility},${e.features.playerHomeAway},
    ${e.features.playerOpponent},${e.features.playerUsage},${e.features.playerRosterContinuity},
    now(),${n.json(e.features)}
   )
   on conflict (athlete_id,sport,stat_key) do update set
    sample_size=excluded.sample_size,form_signal=excluded.form_signal,volatility=excluded.volatility,
    home_away_signal=excluded.home_away_signal,opponent_signal=excluded.opponent_signal,
    usage_signal=excluded.usage_signal,roster_continuity=excluded.roster_continuity,
    last_observed_at=now(),features=excluded.features
  `}return a}async function h(){let t=e();if(!t)return{configured:!1,totalFrames:0,learningProfiles:0,rosterSnapshots:0,sports:[],top:[]};let[n,r,i]=await Promise.all([t`
   select
    (select count(*)::int from player_feature_frames) as "totalFrames",
    (select count(*)::int from player_learning_state) as "learningProfiles",
    (select count(*)::int from player_roster_snapshots) as "rosterSnapshots"
  `,t`
   select sport,count(*)::int as frames,count(distinct player_name)::int as players,
          avg((features->>'playerSampleConfidence')::numeric)::float as "sampleConfidence"
   from player_feature_frames
   where observed_hour>now()-interval '7 days'
   group by sport order by frames desc
  `,t`
   select a.name as "playerName",pls.sport,pls.stat_key as "statKey",pls.sample_size as "sampleSize",
          pls.form_signal::float as "playerForm",pls.volatility::float as "playerVolatility",
          pls.home_away_signal::float as "playerHomeAway",pls.opponent_signal::float as "playerOpponent",
          pls.usage_signal::float as "playerUsage",pls.roster_continuity::float as "playerRosterContinuity",
          pls.last_observed_at as "lastObservedAt"
   from player_learning_state pls
   join athletes a on a.id=pls.athlete_id
   order by pls.last_observed_at desc
   limit 30
  `]),a=n[0]||{};return{configured:!0,totalFrames:Number(a.totalFrames||0),learningProfiles:Number(a.learningProfiles||0),rosterSnapshots:Number(a.rosterSnapshots||0),sports:r,top:i}}export{m as i,p as n,h as r,d as t};