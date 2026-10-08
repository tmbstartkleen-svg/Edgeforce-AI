import{t as e}from"./db-9LtqYd6N.js";import{r as t}from"./context-dSCfyRbn.js";import{createHash as n}from"node:crypto";var r=e=>e&&typeof e==`object`&&!Array.isArray(e)?e:{},i=e=>{if(Array.isArray(e))return e;let t=r(e);for(let e of[`data`,`results`,`players`,`athletes`,`games`,`rows`,`items`])if(Array.isArray(t[e]))return t[e];return[]},a=e=>typeof e==`string`?e.trim():``,o=e=>{let t=typeof e==`number`?e:Number(e);return Number.isFinite(t)?t:void 0},s=e=>{if(typeof e==`boolean`)return e;if(typeof e==`number`)return e!==0;if(typeof e==`string`){let t=e.toLowerCase();if([`true`,`yes`,`1`,`starter`,`starting`,`started`].includes(t))return!0;if([`false`,`no`,`0`,`bench`,`reserve`,`substitute`].includes(t))return!1}},c=e=>e.toLowerCase().normalize(`NFKD`).replace(/[^a-z0-9]+/g,` `).replace(/\s+/g,` `).trim(),l=e=>e.toLowerCase().replace(/[^a-z0-9]+/g,``),u=(e,t)=>`ath-`+n(`sha1`).update(e.toLowerCase()+`|`+c(t)).digest(`hex`).slice(0,20);function d(e){let t=e.statDate??e.stat_date??e.gameDate??e.game_date??e.date??e.startTime??e.start_time??e.commence_time;if(typeof t==`number`){let e=new Date(t>0xe8d4a51000?t:t*1e3);if(Number.isFinite(e.getTime()))return e.toISOString()}let n=a(t);if(n){let e=new Date(n);if(Number.isFinite(e.getTime()))return e.toISOString()}return new Date().toISOString()}function f(e){let t=[r(e.stats),r(e.statistics),r(e.boxScore),r(e.box_score),r(e.statLine),r(e.stat_line)],n={};for(let e of t)for(let[t,r]of Object.entries(e)){let e=o(r);e!==void 0&&(n[l(t)]=e)}for(let t of`points.rebounds.assists.steals.blocks.turnovers.minutes.usage.passingYards.passing_yards.passingTDs.passing_tds.rushingYards.rushing_yards.receivingYards.receiving_yards.receptions.targets.carries.hits.runs.rbi.homeRuns.home_runs.totalBases.total_bases.strikeouts.walks.pitchingStrikeouts.pitching_strikeouts.inningsPitched.innings_pitched.shots.shotsOnGoal.shots_on_goal.saves.goals.pointsScored.points_scored.aces.doubleFaults.double_faults.gamesWon.games_won.setsWon.sets_won`.split(`.`)){let r=o(e[t]);r!==void 0&&(n[l(t)]=r)}return n}function p(e,t,i){let l=r(e),p=r(l.player||l.athlete),m=a(l.playerName??l.player_name??l.athleteName??l.athlete_name??p.name??l.name),h=a(l.sport??l.league??p.sport);if(!m||!h)return null;let g=c(m),_=a(l.playerId??l.player_id??l.athleteId??l.athlete_id??p.id),v=_||u(h,m),y=d(l),b=a(l.opponent??l.opponentName??l.opponent_name),x=a(l.eventId??l.event_id??l.gameId??l.game_id??l.matchId??l.match_id)||`event-`+n(`sha1`).update([i,v,y,b,t].join(`|`)).digest(`hex`).slice(0,22),S=a(l.team??l.teamName??l.team_name??p.team),C=a(l.position??p.position),w=a(l.homeAway??l.home_away??l.location),T=o(l.minutes??l.minutesPlayed??l.minutes_played),E=o(l.usage??l.usageRate??l.usage_rate),D=s(l.starter??l.isStarter??l.is_starter??l.starting??l.started),O=f(l);return Object.keys(O).length?{athleteId:v,sourceId:_||void 0,name:m,normalizedName:g,sport:h,team:S||void 0,position:C||void 0,eventId:x,statDate:y,opponent:b||void 0,homeAway:w||void 0,minutes:T,usageRate:E,starter:D,stats:O,raw:l}:null}function m(e){if(!e.length)return null;let t=e.reduce((e,t)=>e+t,0)/e.length,n=e.reduce((e,n)=>e+(n-t)**2,0)/e.length;return{mean:t,stdDev:Math.sqrt(n),min:Math.min(...e),max:Math.max(...e),last:e[0],sampleSize:e.length}}function h(e,t){let n=e.slice(0,t),i=new Set;for(let e of n)for(let t of Object.keys(r(e.stats)))i.add(t);let a={};for(let e of i){let t=m(n.map(t=>o(r(t.stats)[e])).filter(e=>e!==void 0));t&&(a[e]=t)}return{games:n.length,stats:a}}async function g(e,t,n){let r=await e`
  select stats
  from player_game_stats
  where athlete_id=${t}
  order by stat_date desc
  limit 250
 `;if(!r.length)return 0;let i=0;for(let[a,o]of[[`LAST_5`,5],[`LAST_10`,10],[`LAST_20`,20],[`ALL`,250]]){let s=h(r,o);await e`
   insert into player_features(athlete_id,as_of,source_window,features,sample_size,source)
   values(${t},now(),${a},${e.json(s)},${s.games},${n})
  `,i++}return i}async function _(t,n=`stats-provider`){let r=e(),a=i(t);if(!r)return{configured:!1,providerId:n,rowsSeen:a.length,gamesWritten:0,athletesTouched:0,featureSnapshotsWritten:0,error:`database not configured`};let o=a.map((e,t)=>p(e,t,n)).filter(e=>!!e),s=new Set,c=0;for(let e of o){await r`
   insert into athletes(id,source_id,name,normalized_name,sport,team,position,metadata,last_seen_at)
   values(${e.athleteId},${e.sourceId??null},${e.name},${e.normalizedName},${e.sport},${e.team??null},${e.position??null},'{}'::jsonb,now())
   on conflict (id) do update set
    source_id=coalesce(excluded.source_id,athletes.source_id),
    name=excluded.name,normalized_name=excluded.normalized_name,sport=excluded.sport,
    team=coalesce(excluded.team,athletes.team),position=coalesce(excluded.position,athletes.position),
    last_seen_at=now()
  `,await r`
   insert into athlete_aliases(athlete_id,alias,normalized_alias,source)
   values(${e.athleteId},${e.name},${e.normalizedName},${n})
   on conflict (athlete_id,normalized_alias) do nothing
  `;let t=await r`
   insert into player_game_stats(
    athlete_id,event_id,stat_date,opponent,home_away,team,minutes,usage_rate,starter,stats,source,raw
   ) values(
    ${e.athleteId},${e.eventId},${e.statDate},${e.opponent??null},${e.homeAway??null},
    ${e.team??null},${e.minutes??null},${e.usageRate??null},${e.starter??null},${r.json(e.stats)},${n},${r.json(e.raw)}
   )
   on conflict (athlete_id,event_id,source) do update set
    stat_date=excluded.stat_date,opponent=excluded.opponent,home_away=excluded.home_away,
    team=excluded.team,minutes=excluded.minutes,usage_rate=excluded.usage_rate,starter=excluded.starter,
    stats=excluded.stats,raw=excluded.raw,ingested_at=now()
   returning id
  `;c+=t.length,s.add(e.athleteId)}let l=new Map;for(let e of o){let t=l.get(e.athleteId);(!t||new Date(e.statDate).getTime()>new Date(t.statDate).getTime())&&l.set(e.athleteId,e)}let u=new Date(Math.floor(Date.now()/36e5)*36e5).toISOString();for(let e of l.values())try{await r`
    insert into player_roster_snapshots(athlete_id,sport,team,position,roster_status,source,observed_hour,metadata)
    values(${e.athleteId},${e.sport},${e.team??null},${e.position??null},'ACTIVE',${n},${u},${r.json({sourceId:e.sourceId||null,lastEventId:e.eventId,starter:e.starter??null})})
    on conflict (athlete_id,source,observed_hour) do update set
     sport=excluded.sport,team=excluded.team,position=excluded.position,metadata=excluded.metadata
   `}catch{}let d=0;for(let e of s)d+=await g(r,e,n);return{configured:!0,providerId:n,rowsSeen:a.length,gamesWritten:c,athletesTouched:s.size,featureSnapshotsWritten:d}}async function v(){let e=await t();return!e.ok||e.data===void 0?{configured:!!e.attempts.length,providerId:e.providerId,rowsSeen:0,gamesWritten:0,athletesTouched:0,featureSnapshotsWritten:0,error:e.error||`stats provider unavailable`}:_(e.data,e.providerId||e.providerName||`stats-provider`)}function y(e,t){let n=(e+` `+t).toLowerCase();for(let[e,t]of[[/passing\s*yards?/,`passingyards`],[/passing\s*(tds?|touchdowns?)/,`passingtds`],[/rushing\s*yards?/,`rushingyards`],[/receiving\s*yards?/,`receivingyards`],[/receptions?/,`receptions`],[/targets?/,`targets`],[/carries/,`carries`],[/pitch(?:er|ing).*strikeouts?|strikeouts?/,`strikeouts`],[/total\s*bases?/,`totalbases`],[/home\s*runs?/,`homeruns`],[/\brbi\b/,`rbi`],[/\bhits?\b/,`hits`],[/shots?\s*on\s*goal/,`shotsongoal`],[/\bsaves?\b/,`saves`],[/\bgoals?\b/,`goals`],[/\bpoints?\b/,`points`],[/rebounds?/,`rebounds`],[/assists?/,`assists`],[/three[- ]?pointers?|3[- ]?pointers?|threes?/,`threepointers`],[/\baces?\b/,`aces`],[/double\s*faults?/,`doublefaults`],[/games?\s*won/,`gameswon`],[/sets?\s*won/,`setswon`]])if(e.test(n))return t;return``}function b(e,t){let n=r(r(e.stats)[l(t)]);return Object.keys(n).length?n:null}async function x(t){let n=e(),i=t.filter(e=>e.playerContext?.name);if(!n||!i.length)return{markets:t,matched:0,players:0};let a=[...new Set(i.map(e=>c(e.playerContext.name)).filter(Boolean))];if(!a.length)return{markets:t,matched:0,players:0};let s=await n`
  select id,name,normalized_name as "normalizedName",sport
  from athletes
  where normalized_name in ${n(a)}
 `;if(!s.length)return{markets:t,matched:0,players:0};let u=await n`
  select distinct on (athlete_id,source_window)
   athlete_id as "athleteId",source_window as "sourceWindow",features,sample_size as "sampleSize",as_of as "asOf"
  from player_features
  where athlete_id in ${n(s.map(e=>String(e.id)))}
  order by athlete_id,source_window,as_of desc
 `,d=new Map;for(let e of s){let t=u.filter(t=>String(t.athleteId)===String(e.id));d.set(String(e.normalizedName),{...e,windows:t})}let f=0;return{markets:t.map(e=>{let t=e.playerContext;if(!t?.name)return e;let n=d.get(c(t.name));if(!n)return e;let i=l(t.statKey||y(e.market,e.selection));if(!i)return e;let a=[`LAST_10`,`LAST_20`,`ALL`],s=null,u=``,p=0;for(let e of a){let t=n.windows.find(t=>t.sourceWindow===e);if(!t)continue;let a=b(r(t.features),i);if(a){s=a,u=e,p=Number(t.sampleSize||a.sampleSize||0);break}}if(!s||p<3)return e;let m=o(s.mean),h=o(s.stdDev);if(m===void 0)return e;let g=p>=20?.35:p>=10?.28:.2,_=t.projection,v=_===void 0?m:_*(1-g)+m*g,x=t.stdDev??h,S={...e.sportFeatures||{},propMean:v,...x===void 0?{}:{propStd:x},historicalSampleSize:p,historicalMean:m},C=[...new Set([...e.contextSources||[],`player-history-db`])],w=[...e.contextProvenance||[],{source:`player-history-db`,providerId:`edgeforce-player-warehouse`,field:`player.`+i+`.`+u.toLowerCase(),observedAt:new Date().toISOString(),confidence:p>=20?.94:p>=10?.88:.78,status:`CACHED`,detail:{sampleSize:p,mean:m,stdDev:h,window:u}}];return f++,{...e,sportFeatures:S,contextSources:C,contextProvenance:w,playerContext:{...t,projection:v,stdDev:x,statKey:t.statKey||i}}}),matched:f,players:d.size}}function S(e){let t=[...`${e.market} ${e.selection}`.matchAll(/([+-]?\d+(?:\.\d+)?)/g)].map(e=>Number(e[1])).filter(Number.isFinite);return t.length?t[t.length-1]:void 0}async function C(t){let n=e();if(!n)return 0;let r=t.filter(e=>e.playerContext?.name);if(!r.length)return 0;let i=await n`
  select id,normalized_name as "normalizedName"
  from athletes
  where normalized_name in ${n([...new Set(r.map(e=>c(e.playerContext.name)))])}
 `,a=new Map(i.map(e=>[String(e.normalizedName),String(e.id)])),o=new Date(Math.floor(Date.now()/36e5)*36e5).toISOString(),s=0;for(let e of r){let t=(e.market+` `+e.selection).toLowerCase(),r=t.includes(`under`)?`UNDER`:t.includes(`over`)?`OVER`:`OTHER`,i=S(e),u=e.playerContext.name,d=a.get(c(u)),f=e.id.includes(`:`)?e.id.split(`:`)[0]:e.id,p=l(e.playerContext?.statKey||y(e.market,e.selection)),m=e.sourceBook||e.consensus?.bestBook||`Unknown`,h=await n`
   insert into player_prop_predictions(
    market_id,athlete_id,player_name,sport,event_id,event_label,stat_key,direction,line,venue,
    offered_odds,model_probability,sim_probability,dynamic_confidence,observed_hour,raw
   ) values(
    ${e.id},${d??null},${u},${e.sport},${f},${e.event},
    ${p||null},${r},${i??null},${m},${e.odds},${e.modelProb},
    ${e.simProbability},${e.dynamicConfidence},${o},
    ${n.json({market:e.market,selection:e.selection,sourceBook:e.sourceBook,consensus:e.consensus||null})}
   )
   on conflict (market_id,venue,observed_hour) do update set
    offered_odds=excluded.offered_odds,model_probability=excluded.model_probability,
    sim_probability=excluded.sim_probability,dynamic_confidence=excluded.dynamic_confidence,raw=excluded.raw
   returning id
  `;s+=h.length}return s}async function w(t){let n=e();if(!n)return{matched:0,settled:0};let r=0,i=0;for(let e of t){let t=await n`
   update player_prop_predictions
   set result=${e.result},
       closing_odds=coalesce(${e.closingOdds??null},closing_odds),
       settled_at=${e.settledAt||new Date().toISOString()}
   where result is null
    and event_id=${e.eventId}
    and lower(coalesce(raw->>'selection',''))=lower(${e.selectionKey})
    and (
      ${e.marketKey??null}::text is null
      or lower(coalesce(raw->>'market',''))=lower(${e.marketKey??``})
    )
   returning id
  `;r+=t.length,i+=t.length}return{matched:r,settled:i}}async function T(){let t=e();if(!t)return{configured:!1,overall:[],sports:[],stats:[],directions:[],bands:[]};let n=await t`
  select sport,coalesce(stat_key,'unknown') as "statKey",direction,sim_probability::float as "simProbability",result
  from player_prop_predictions
  where result in ('win','loss','push')
 `,r=e=>{let t=new Map;for(let r of n){let n=e(r),i=t.get(n)||{key:n,count:0,wins:0,losses:0,pushes:0};i.count++,r.result===`win`?i.wins++:r.result===`loss`?i.losses++:i.pushes++,t.set(n,i)}return[...t.values()].map(e=>({...e,hitRate:e.wins+e.losses?e.wins/(e.wins+e.losses):0})).sort((e,t)=>t.hitRate-e.hitRate||t.count-e.count)},i=e=>e>=.8?`80%+`:e>=.75?`75-79.9%`:e>=.7?`70-74.9%`:e>=.65?`65-69.9%`:e>=.6?`60-64.9%`:`<60%`;return{configured:!0,settled:n.length,overall:r(()=>`ALL`),sports:r(e=>e.sport),stats:r(e=>e.sport+` • `+e.statKey),directions:r(e=>e.sport+` • `+e.direction),bands:r(e=>i(Number(e.simProbability||0)))}}export{w as a,C as i,T as n,v as o,c as r,x as t};