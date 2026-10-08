import{t as e}from"./db-9LtqYd6N.js";var t=(e,t=-1,n=1)=>Math.max(t,Math.min(n,e)),n=e=>t(e,0,1),r=e=>{let t=Number(e);return Number.isFinite(t)?t:void 0};function i(e){let t=e.toLowerCase();return t===`nfl`||t===`ncaaf`||t.includes(`football`)?`football`:t===`mlb`||t.includes(`baseball`)?`baseball`:t===`mls`||t===`epl`||t.includes(`soccer`)?`soccer`:t===`nba`||t===`wnba`||t===`ncaab`||t.includes(`basketball`)?`basketball`:t===`nhl`||t.includes(`hockey`)?`hockey`:t===`ufc`||t.includes(`mma`)?`combat`:`other`}function a(e){let t=(e||``).toLowerCase();return/artificial|synthetic|turf/.test(t)?`turf`:/natural|grass/.test(t)?`grass`:/clay/.test(t)?`clay`:/hard/.test(t)?`hard`:/ice/.test(t)?`ice`:/court|wood|hardwood/.test(t)?`court`:t.replace(/[^a-z0-9]+/g,` `).trim()||void 0}function o(e){let o=i(e.sportKey),s=!!e.indoor,c=e.weather||{},l=r(c.temperatureF),u=r(c.apparentTemperatureF)??l,d=r(c.humidityPct),f=r(c.precipitationProbability)??0,p=r(c.precipitationIn)??0,m=r(c.snowfallIn)??0,h=r(c.windMph)??0,g=r(c.windGustMph)??h,_=Math.max(0,r(e.elevationFt)??0),v=a(e.surface),y=t(r(e.parkSignal)??0),b=s||u===void 0?0:n((45-u)/35),x=s||u===void 0?0:n((u-82)/28),S=Math.max(b,x),C=s?0:n((Math.max(h,g*.82)-10)/28),w=s?0:n((g-18)/30),T=s?0:n(f/100*.55+Math.min(1,p/.22)*.45),E=s?0:n(m/.18),D=s||d===void 0?0:n(Math.abs(d-55)/45),O=n(Math.max(0,_-1200)/5200),k=0,A=0,j=0,M=0,N=0,P=0,F=0,I=0,L=0;o===`football`?(k=-b*.2-x*.1,A=-C*.48,j=-T*.24-E*.32,M=-x*D*.05,N=-O*.03,P=O*.11,F=v===`turf`?.035:0,I=k*.18+A*.1+j*.22+F*.35,L=C*.22+w*.22+T*.24+E*.3+S*.08):o===`baseball`?(k=l===void 0?0:t((l-70)/45)*.28,A=-C*.1,j=-T*.16,M=(d===void 0?0:t((d-55)/45))*.05,N=O*.26,P=O*.035,F=v===`turf`?.025:0,I=0,L=C*.28+w*.28+T*.34+S*.06):o===`soccer`?(k=-b*.08-x*.2,A=-C*.28,j=-T*.14-E*.24,M=-x*D*.08,N=-O*.05,P=O*.13,F=v===`turf`?.03:0,I=-x*.18-T*.08+F*.3,L=C*.18+w*.2+T*.2+E*.24+S*.1):o===`basketball`?(N=-O*.025,P=O*.1,I=-O*.035,F=0,L=O*.04):o===`hockey`?(N=-O*.018,P=O*.07,I=-O*.025,L=O*.025):o===`combat`?(N=-O*.02,P=0,I=-O*.07,L=O*.12):(k=-S*.08,A=-C*.12,j=-T*.1,P=O*.04,L=C*.12+T*.12);let R=n(S*.18+C*.26+w*.18+T*.24+E*.28+x*D*.08),z=t(k+A+j+M+N+F+y*.12,-.65,.65),B=t(P,-.25,.25),V=t(z*.62+B*.23+I*.15,-1,1),H=[l,d,r(c.windMph),r(c.precipitationProbability)].filter(e=>e!==void 0).length,U=n((s?.96:n(.48+H*.105+(r(c.windGustMph)===void 0?0:.05)+(r(c.apparentTemperatureF)===void 0?0:.03)))+(_>0?.06:0));return{venueWeatherComposite:V,venueConditionSeverity:R,venueTotalEffect:z,venueHomeEdge:B,venuePaceEffect:t(I,-.45,.45),venueVolatilityEffect:n(L),venueWeatherConfidence:U,venueTemperatureEffect:t(k),venueWindEffect:t(A),venuePrecipEffect:t(j),venueHumidityEffect:t(M),venueAltitudeEffect:t(N+P),venueSurfaceEffect:t(F),venueIndoor:s?1:0,weather:t(z,-1,1)}}function s(e,t,n){return[e||``,t||``,n||``].join(`|`).toLowerCase().replace(/[^a-z0-9|]+/g,` `).replace(/\s+/g,` `).trim()||`unknown`}async function c(t){let n=e();if(!n)return 0;let i=new Date(Math.floor(Date.now()/36e5)*36e5).toISOString(),a=0,o=new Set;for(let e of t){let t=e.sportFeatures||{},c=Number(t.venueWeatherConfidence);if(!Number.isFinite(c)||c<=0)continue;let l=e.id.split(`:`)[0],u=[e.sport,l].join(`|`);if(o.has(u))continue;o.add(u);let d=(e.contextProvenance||[]).find(e=>e.providerId===`edgeforce-v68-venue-conditions`)?.detail||{},f=s(String(d.venue||``),String(d.city||``),String(d.state||``));await n`
   insert into venue_condition_snapshots(
    sport,event_id,event_name,start_time,venue_key,venue_name,city,state,country,indoor,surface,elevation_ft,
    temperature_f,apparent_temperature_f,humidity_pct,precipitation_probability,precipitation_in,snowfall_in,
    wind_mph,wind_gust_mph,cloud_cover_pct,condition_severity,total_effect,home_edge,pace_effect,volatility_effect,
    confidence,observed_hour,metadata
   ) values(
    ${e.sport},${l},${e.event},${e.startTime},${f},${String(d.venue||``)||null},
    ${String(d.city||``)||null},${String(d.state||``)||null},${String(d.country||``)||null},
    ${!!d.indoor},${String(d.surface||``)||null},${r(d.elevationFt)??null},
    ${r(d.temperatureF)??null},${r(d.apparentTemperatureF)??null},${r(d.humidityPct)??null},
    ${r(d.precipProbability)??null},${r(d.precipitationIn)??null},${r(d.snowfallIn)??null},
    ${r(d.windMph)??null},${r(d.gustMph)??null},${r(d.cloudCoverPct)??null},
    ${Number(t.venueConditionSeverity)||0},${Number(t.venueTotalEffect)||0},${Number(t.venueHomeEdge)||0},
    ${Number(t.venuePaceEffect)||0},${Number(t.venueVolatilityEffect)||0},${c},${i},
    ${n.json({composite:Number(t.venueWeatherComposite)||0})}
   )
   on conflict (sport,event_id,observed_hour) do update set
    venue_key=excluded.venue_key,venue_name=excluded.venue_name,city=excluded.city,state=excluded.state,country=excluded.country,
    indoor=excluded.indoor,surface=excluded.surface,elevation_ft=excluded.elevation_ft,temperature_f=excluded.temperature_f,
    apparent_temperature_f=excluded.apparent_temperature_f,humidity_pct=excluded.humidity_pct,
    precipitation_probability=excluded.precipitation_probability,precipitation_in=excluded.precipitation_in,
    snowfall_in=excluded.snowfall_in,wind_mph=excluded.wind_mph,wind_gust_mph=excluded.wind_gust_mph,
    cloud_cover_pct=excluded.cloud_cover_pct,condition_severity=excluded.condition_severity,total_effect=excluded.total_effect,
    home_edge=excluded.home_edge,pace_effect=excluded.pace_effect,volatility_effect=excluded.volatility_effect,
    confidence=excluded.confidence,metadata=excluded.metadata
  `,a++}return a}async function l(){let t=e();if(!t)return{configured:!1,snapshotsRead:0,profilesWritten:0,venuesProfiled:0};let n=await t`insert into venue_condition_runs(model_version) values(${process.env.MODEL_VERSION||`edgeforce-v61`}) returning id`,r=Number(n[0]?.id||0),i=await t`
  select sport,venue_key as "venueKey",max(venue_name) as "venueName",count(*)::int as n,
         avg(case when indoor then 1 else 0 end)::float as "indoorRate",
         avg(temperature_f)::float as temp,avg(humidity_pct)::float as humidity,avg(wind_mph)::float as wind,
         avg(elevation_ft)::float as elevation,avg(condition_severity)::float as severity,
         avg(total_effect)::float as "totalEffect",avg(home_edge)::float as "homeEdge",
         avg(volatility_effect)::float as volatility,avg(confidence)::float as confidence
  from venue_condition_snapshots
  where observed_hour>now()-interval '365 days'
  group by sport,venue_key
 `,a=0,o=0;for(let e of i)o+=Number(e.n||0),await t`
   insert into venue_condition_profiles(
    sport,venue_key,venue_name,sample_count,indoor_rate,avg_temperature_f,avg_humidity_pct,avg_wind_mph,
    avg_elevation_ft,avg_condition_severity,avg_total_effect,avg_home_edge,avg_volatility_effect,avg_confidence,updated_at,metadata
   ) values(
    ${e.sport},${e.venueKey},${e.venueName||null},${e.n},${e.indoorRate||0},${e.temp??null},
    ${e.humidity??null},${e.wind??null},${e.elevation??null},${e.severity||0},${e.totalEffect||0},
    ${e.homeEdge||0},${e.volatility||0},${e.confidence||0},now(),${t.json({lookbackDays:365})}
   )
   on conflict (sport,venue_key) do update set
    venue_name=excluded.venue_name,sample_count=excluded.sample_count,indoor_rate=excluded.indoor_rate,
    avg_temperature_f=excluded.avg_temperature_f,avg_humidity_pct=excluded.avg_humidity_pct,avg_wind_mph=excluded.avg_wind_mph,
    avg_elevation_ft=excluded.avg_elevation_ft,avg_condition_severity=excluded.avg_condition_severity,
    avg_total_effect=excluded.avg_total_effect,avg_home_edge=excluded.avg_home_edge,
    avg_volatility_effect=excluded.avg_volatility_effect,avg_confidence=excluded.avg_confidence,updated_at=now(),metadata=excluded.metadata
  `,a++;return r&&await t`update venue_condition_runs set snapshots_read=${o},profiles_written=${a},venues_profiled=${a},completed_at=now(),metadata=${t.json({lookbackDays:365})} where id=${r}`,{configured:!0,snapshotsRead:o,profilesWritten:a,venuesProfiled:a}}async function u(){let t=e();if(!t)return{configured:!1,snapshots24h:0,profiles:0,severe24h:0,recent:[]};let[n,r]=await Promise.all([t`
   select
    (select count(*)::int from venue_condition_snapshots where observed_hour>now()-interval '24 hours') as "snapshots24h",
    (select count(*)::int from venue_condition_profiles) as profiles,
    (select count(*)::int from venue_condition_snapshots where observed_hour>now()-interval '24 hours' and condition_severity>=.45) as "severe24h"
  `,t`
   select sport,event_name as "eventName",start_time as "startTime",venue_name as "venueName",indoor,surface,
          elevation_ft::float as "elevationFt",temperature_f::float as "temperatureF",humidity_pct::float as "humidityPct",
          wind_mph::float as "windMph",wind_gust_mph::float as "gustMph",precipitation_probability::float as "precipProbability",
          condition_severity::float as severity,total_effect::float as "totalEffect",home_edge::float as "homeEdge",
          volatility_effect::float as volatility,confidence::float as confidence
   from venue_condition_snapshots where observed_hour>now()-interval '24 hours'
   order by condition_severity desc,abs(total_effect) desc limit 30
  `]),i=n[0]||{};return{configured:!0,snapshots24h:Number(i.snapshots24h||0),profiles:Number(i.profiles||0),severe24h:Number(i.severe24h||0),recent:r}}export{c as a,l as i,u as n,a as r,o as t};