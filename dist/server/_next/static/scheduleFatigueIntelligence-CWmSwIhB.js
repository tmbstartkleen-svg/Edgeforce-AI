import{t as e}from"./db-9LtqYd6N.js";var t=e=>e&&typeof e==`object`&&!Array.isArray(e)?e:{},n=e=>Array.isArray(e)?e:[],r=e=>typeof e==`string`?e:``,i=(e,t=-1,n=1)=>Math.max(t,Math.min(n,e)),a=e=>i(e,0,1),o=864e5;function s(e){return r(t(e.team).id)||r(e.id)}function c(e){return n(t(e).events||e).map(t)}function l(e){let i=t(t(n(e.competitions)[0]).venue),a=t(i.address),o={name:r(i.fullName)||r(i.name)||void 0,city:r(a.city)||void 0,state:r(a.state)||void 0,country:r(a.country)||void 0};return o.name||o.city?o:void 0}function u(e,i,a){let o=new Date(i).getTime();if(!Number.isFinite(o))return[];let u=[];for(let i of c(e)){let e=t(n(i.competitions)[0]),c=r(i.date)||r(e.date),d=new Date(c).getTime();if(!Number.isFinite(d)||d>=o-6*36e5)continue;let f=n(e.competitors).map(t).find(e=>s(e)===a);f&&u.push({date:c,time:d,homeAway:r(f.homeAway).toLowerCase(),venue:l(i)})}return u.sort((e,t)=>t.time-e.time)}function d(e,t,n,r){let i=new Date(t).getTime(),s=u(e,t,n);if(!Number.isFinite(i)||!s.length)return{games3d:0,games4d:0,games6d:0,games7d:0,backToBack:0,threeInFour:0,fourInSix:0,roadStreak:r===`away`?1:0,density:0,fatigueLoad:0,confidence:0};let c=s[0],l=Math.max(0,(i-c.time)/o),d=e=>s.filter(t=>i-t.time<=e*o).length,f=d(3),p=d(4),m=d(6),h=d(7),g=l<=1.55?1:0,_=p>=2?1:0,v=m>=3?1:0,y=r===`away`?1:0;if(r===`away`)for(let e of s){if(e.homeAway!==`away`)break;y++}let b=a((h+1)/5),x=a(Math.max(0,y-1)/4),S=a(g*.42+_*.24+v*.18+b*.1+x*.12),C=a(.45+Math.min(s.length,8)/8*.45+(c.venue?.city?.1:0));return{restDays:l,games3d:f,games4d:p,games6d:m,games7d:h,backToBack:g,threeInFour:_,fourInSix:v,roadStreak:y,density:b,fatigueLoad:S,confidence:C,priorEventDate:c.date,priorVenue:c.venue}}function f(e,t){let n=e=>e*Math.PI/180,r=n(t.latitude-e.latitude),i=n(t.longitude-e.longitude),a=n(e.latitude),o=n(t.latitude),s=Math.sin(r/2)**2+Math.cos(a)*Math.cos(o)*Math.sin(i/2)**2;return 3958.7613*2*Math.atan2(Math.sqrt(s),Math.sqrt(Math.max(0,1-s)))}function p(e,t,n){if(e)try{let n=new Date(t),r=(new Intl.DateTimeFormat(`en-US`,{timeZone:e,timeZoneName:`shortOffset`,hour:`2-digit`}).formatToParts(n).find(e=>e.type===`timeZoneName`)?.value||``).match(/GMT([+-]\d{1,2})(?::(\d{2}))?/i);if(r){let e=Number(r[1]),t=Number(r[2]||0);return e+(e<0?-t:t)/60}}catch{}return Math.max(-12,Math.min(14,n/15))}function m(e,t,n,r){if(!e||!t)return{distanceMiles:0,timezoneShiftHours:0,eastward:0,recoveryFactor:1,burden:0,confidence:0};let i=f(e,t),o=p(e.timezone,r,e.longitude),s=p(t.timezone,r,t.longitude),c=Math.abs(s-o),l=s>o?1:0,u=a(1-Math.max(0,(n??1)-1)*.24),d=a(i/2200),m=a(c/3);return{distanceMiles:i,timezoneShiftHours:c,eastward:l,recoveryFactor:u,burden:a((d*.62+m*.28+l*m*.1)*u),confidence:e.timezone&&t.timezone?.length?.92:.78}}function h(e,t,n,r){let o=e.restDays??2.5,s=t.restDays??2.5,c=i((o-s)/3.5),l=i(r.burden-n.burden),u=i(t.fatigueLoad-e.fatigueLoad),d=i((t.density-e.density)*1.4),f=a((e.confidence+t.confidence+n.confidence+r.confidence)/4);return{scheduleRestEdge:c,scheduleTravelEdge:l,scheduleFatigueEdge:u,scheduleDensityEdge:d,scheduleCompositeEdge:i(c*.3+l*.25+u*.3+d*.15),scheduleContextConfidence:f,scheduleUncertainty:a(1-f),rest:c,travel:i(n.burden-r.burden),fatigue:i(e.fatigueLoad-t.fatigueLoad),scheduleHomeRestDays:o,scheduleAwayRestDays:s,scheduleHomeTravelMiles:n.distanceMiles,scheduleAwayTravelMiles:r.distanceMiles,scheduleHomeTimezoneShift:n.timezoneShiftHours,scheduleAwayTimezoneShift:r.timezoneShiftHours,scheduleHomeFatigue:e.fatigueLoad,scheduleAwayFatigue:t.fatigueLoad,scheduleHomeGames7d:e.games7d+1,scheduleAwayGames7d:t.games7d+1,scheduleHomeRoadStreak:e.roadStreak,scheduleAwayRoadStreak:t.roadStreak}}async function g(t){let n=e();if(!n)return 0;let r=new Date(Math.floor(Date.now()/36e5)*36e5).toISOString(),i=0,a=new Set;for(let e of t){let t=e.sportFeatures||{},o=Number(t.scheduleContextConfidence);if(!Number.isFinite(o)||o<=0)continue;let s=e.id.split(`:`)[0],c=[e.sport,s].join(`|`);a.has(c)||(a.add(c),await n`
   insert into schedule_fatigue_snapshots(
    sport,event_id,event_name,start_time,home,away,home_rest_days,away_rest_days,home_travel_miles,away_travel_miles,
    home_timezone_shift,away_timezone_shift,home_fatigue,away_fatigue,rest_edge,travel_edge,fatigue_edge,density_edge,
    composite_edge,confidence,observed_hour,metadata
   ) values(
    ${e.sport},${s},${e.event},${e.startTime},${e.home},${e.away},
    ${Number(t.scheduleHomeRestDays)||null},${Number(t.scheduleAwayRestDays)||null},
    ${Number(t.scheduleHomeTravelMiles)||0},${Number(t.scheduleAwayTravelMiles)||0},
    ${Number(t.scheduleHomeTimezoneShift)||0},${Number(t.scheduleAwayTimezoneShift)||0},
    ${Number(t.scheduleHomeFatigue)||0},${Number(t.scheduleAwayFatigue)||0},
    ${Number(t.scheduleRestEdge)||0},${Number(t.scheduleTravelEdge)||0},${Number(t.scheduleFatigueEdge)||0},
    ${Number(t.scheduleDensityEdge)||0},${Number(t.scheduleCompositeEdge)||0},${o},${r},
    ${n.json({homeGames7d:Number(t.scheduleHomeGames7d)||0,awayGames7d:Number(t.scheduleAwayGames7d)||0,homeRoadStreak:Number(t.scheduleHomeRoadStreak)||0,awayRoadStreak:Number(t.scheduleAwayRoadStreak)||0})}
   )
   on conflict (sport,event_id,observed_hour) do update set
    event_name=excluded.event_name,start_time=excluded.start_time,home=excluded.home,away=excluded.away,
    home_rest_days=excluded.home_rest_days,away_rest_days=excluded.away_rest_days,
    home_travel_miles=excluded.home_travel_miles,away_travel_miles=excluded.away_travel_miles,
    home_timezone_shift=excluded.home_timezone_shift,away_timezone_shift=excluded.away_timezone_shift,
    home_fatigue=excluded.home_fatigue,away_fatigue=excluded.away_fatigue,
    rest_edge=excluded.rest_edge,travel_edge=excluded.travel_edge,fatigue_edge=excluded.fatigue_edge,
    density_edge=excluded.density_edge,composite_edge=excluded.composite_edge,confidence=excluded.confidence,metadata=excluded.metadata
  `,i++)}return i}async function _(){let t=e();if(!t)return{configured:!1,snapshotsRead:0,profilesWritten:0};let n=await t`insert into schedule_fatigue_runs(model_version) values(${process.env.MODEL_VERSION||`edgeforce-v61`}) returning id`,r=Number(n[0]?.id||0),i=await t`
  select sport,count(*)::int as n,
         avg(abs(rest_edge))::float as rest,avg(abs(travel_edge))::float as travel,
         avg(abs(fatigue_edge))::float as fatigue,avg(abs(density_edge))::float as density,
         avg(abs(composite_edge))::float as composite,avg(confidence)::float as confidence,
         avg(case when greatest(home_fatigue,away_fatigue)>=.55 then 1 else 0 end)::float as "highLoadRate"
  from schedule_fatigue_snapshots
  where observed_hour>now()-interval '180 days'
  group by sport
 `,a=0,o=0;for(let e of i)o+=Number(e.n||0),await t`
   insert into schedule_fatigue_profiles(sport,sample_count,avg_abs_rest_edge,avg_abs_travel_edge,avg_abs_fatigue_edge,avg_abs_density_edge,avg_abs_composite_edge,avg_confidence,high_load_rate,updated_at,metadata)
   values(${e.sport},${e.n},${e.rest||0},${e.travel||0},${e.fatigue||0},${e.density||0},${e.composite||0},${e.confidence||0},${e.highLoadRate||0},now(),${t.json({lookbackDays:180})})
   on conflict (sport) do update set
    sample_count=excluded.sample_count,avg_abs_rest_edge=excluded.avg_abs_rest_edge,avg_abs_travel_edge=excluded.avg_abs_travel_edge,
    avg_abs_fatigue_edge=excluded.avg_abs_fatigue_edge,avg_abs_density_edge=excluded.avg_abs_density_edge,
    avg_abs_composite_edge=excluded.avg_abs_composite_edge,avg_confidence=excluded.avg_confidence,
    high_load_rate=excluded.high_load_rate,updated_at=now(),metadata=excluded.metadata
  `,a++;return r&&await t`update schedule_fatigue_runs set snapshots_read=${o},profiles_written=${a},completed_at=now(),metadata=${t.json({lookbackDays:180})} where id=${r}`,{configured:!0,snapshotsRead:o,profilesWritten:a}}async function v(){let t=e();if(!t)return{configured:!1,snapshots24h:0,profiles:0,highLoadEvents24h:0,sports:[],recent:[]};let[n,r,i]=await Promise.all([t`
   select
    (select count(*)::int from schedule_fatigue_snapshots where observed_hour>now()-interval '24 hours') as "snapshots24h",
    (select count(*)::int from schedule_fatigue_profiles) as profiles,
    (select count(*)::int from schedule_fatigue_snapshots where observed_hour>now()-interval '24 hours' and greatest(home_fatigue,away_fatigue)>=.55) as "highLoadEvents24h"
  `,t`select sport,sample_count as "sampleCount",avg_abs_composite_edge::float as "avgComposite",avg_confidence::float as confidence,high_load_rate::float as "highLoadRate" from schedule_fatigue_profiles order by sample_count desc`,t`
   select sport,event_name as "eventName",start_time as "startTime",home,away,
          home_rest_days::float as "homeRestDays",away_rest_days::float as "awayRestDays",
          home_travel_miles::float as "homeTravelMiles",away_travel_miles::float as "awayTravelMiles",
          home_fatigue::float as "homeFatigue",away_fatigue::float as "awayFatigue",
          composite_edge::float as "compositeEdge",confidence::float as confidence
   from schedule_fatigue_snapshots where observed_hour>now()-interval '24 hours'
   order by greatest(home_fatigue,away_fatigue) desc,abs(composite_edge) desc limit 30
  `]),a=n[0]||{};return{configured:!0,snapshots24h:Number(a.snapshots24h||0),profiles:Number(a.profiles||0),highLoadEvents24h:Number(a.highLoadEvents24h||0),sports:r,recent:i}}export{v as a,f as i,d as n,_ as o,m as r,g as s,h as t};