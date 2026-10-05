import {db} from './db';
import type {Market} from './types';

export type WeatherObservation={
 temperatureF?:number;apparentTemperatureF?:number;humidityPct?:number;
 precipitationProbability?:number;precipitationIn?:number;snowfallIn?:number;
 windMph?:number;windGustMph?:number;cloudCoverPct?:number;
 forecastTime?:string;
};
export type VenueConditionInput={
 sportKey:string;indoor?:boolean;surface?:string;elevationFt?:number;
 weather?:WeatherObservation|null;parkSignal?:number;
};
export type VenueConditionSignals={
 venueWeatherComposite:number;
 venueConditionSeverity:number;
 venueTotalEffect:number;
 venueHomeEdge:number;
 venuePaceEffect:number;
 venueVolatilityEffect:number;
 venueWeatherConfidence:number;
 venueTemperatureEffect:number;
 venueWindEffect:number;
 venuePrecipEffect:number;
 venueHumidityEffect:number;
 venueAltitudeEffect:number;
 venueSurfaceEffect:number;
 venueIndoor:number;
 weather:number;
};

const clamp=(n:number,min=-1,max=1)=>Math.max(min,Math.min(max,n));
const clamp01=(n:number)=>clamp(n,0,1);
const finite=(n:unknown)=>{const v=Number(n);return Number.isFinite(v)?v:undefined};

function sportFamily(key:string){
 const s=key.toLowerCase();
 if(s==='nfl'||s==='ncaaf'||s.includes('football'))return 'football';
 if(s==='mlb'||s.includes('baseball'))return 'baseball';
 if(s==='mls'||s==='epl'||s.includes('soccer'))return 'soccer';
 if(s==='nba'||s==='wnba'||s==='ncaab'||s.includes('basketball'))return 'basketball';
 if(s==='nhl'||s.includes('hockey'))return 'hockey';
 if(s==='ufc'||s.includes('mma'))return 'combat';
 return 'other';
}

export function normalizeSurface(value:string|undefined){
 const s=(value||'').toLowerCase();
 if(/artificial|synthetic|turf/.test(s))return 'turf';
 if(/natural|grass/.test(s))return 'grass';
 if(/clay/.test(s))return 'clay';
 if(/hard/.test(s))return 'hard';
 if(/ice/.test(s))return 'ice';
 if(/court|wood|hardwood/.test(s))return 'court';
 return s.replace(/[^a-z0-9]+/g,' ').trim()||undefined;
}

export function deriveVenueConditionSignals(input:VenueConditionInput):VenueConditionSignals{
 const family=sportFamily(input.sportKey);
 const indoor=Boolean(input.indoor);
 const wx=input.weather||{};
 const temperature=finite(wx.temperatureF);
 const apparent=finite(wx.apparentTemperatureF)??temperature;
 const humidity=finite(wx.humidityPct);
 const precipProbability=finite(wx.precipitationProbability)??0;
 const precipitation=finite(wx.precipitationIn)??0;
 const snowfall=finite(wx.snowfallIn)??0;
 const wind=finite(wx.windMph)??0;
 const gust=finite(wx.windGustMph)??wind;
 const elevation=Math.max(0,finite(input.elevationFt)??0);
 const surface=normalizeSurface(input.surface);
 const park=clamp(finite(input.parkSignal)??0);

 const cold=indoor||apparent===undefined?0:clamp01((45-apparent)/35);
 const heat=indoor||apparent===undefined?0:clamp01((apparent-82)/28);
 const extremeTemp=Math.max(cold,heat);
 const windLoad=indoor?0:clamp01((Math.max(wind,gust*.82)-10)/28);
 const gustLoad=indoor?0:clamp01((gust-18)/30);
 const rainLoad=indoor?0:clamp01((precipProbability/100)*.55+Math.min(1,precipitation/.22)*.45);
 const snowLoad=indoor?0:clamp01(snowfall/.18);
 const humidityLoad=indoor||humidity===undefined?0:clamp01(Math.abs(humidity-55)/45);
 const altitudeLoad=clamp01(Math.max(0,elevation-1200)/5200);

 let tempEffect=0,windEffect=0,precipEffect=0,humidityEffect=0,altitudeTotal=0,altitudeHome=0,surfaceEffect=0;
 let paceEffect=0,volatility=0;

 if(family==='football'){
  tempEffect=-cold*.20-heat*.10;
  windEffect=-windLoad*.48;
  precipEffect=-rainLoad*.24-snowLoad*.32;
  humidityEffect=-heat*humidityLoad*.05;
  altitudeTotal=-altitudeLoad*.03; altitudeHome=altitudeLoad*.11;
  surfaceEffect=surface==='turf'?.035:0;
  paceEffect=tempEffect*.18+windEffect*.10+precipEffect*.22+surfaceEffect*.35;
  volatility=windLoad*.22+gustLoad*.22+rainLoad*.24+snowLoad*.30+extremeTemp*.08;
 }else if(family==='baseball'){
  tempEffect=temperature===undefined?0:clamp((temperature-70)/45)*.28;
  windEffect=-windLoad*.10;
  precipEffect=-rainLoad*.16;
  humidityEffect=(humidity===undefined?0:clamp((humidity-55)/45))*.05;
  altitudeTotal=altitudeLoad*.26; altitudeHome=altitudeLoad*.035;
  surfaceEffect=surface==='turf'?.025:surface==='grass'?0:0;
  paceEffect=0;
  volatility=windLoad*.28+gustLoad*.28+rainLoad*.34+extremeTemp*.06;
 }else if(family==='soccer'){
  tempEffect=-cold*.08-heat*.20;
  windEffect=-windLoad*.28;
  precipEffect=-rainLoad*.14-snowLoad*.24;
  humidityEffect=-heat*humidityLoad*.08;
  altitudeTotal=-altitudeLoad*.05; altitudeHome=altitudeLoad*.13;
  surfaceEffect=surface==='turf'?.03:0;
  paceEffect=-heat*.18-rainLoad*.08+surfaceEffect*.30;
  volatility=windLoad*.18+gustLoad*.20+rainLoad*.20+snowLoad*.24+extremeTemp*.10;
 }else if(family==='basketball'){
  altitudeTotal=-altitudeLoad*.025; altitudeHome=altitudeLoad*.10;
  paceEffect=-altitudeLoad*.035;
  surfaceEffect=0;
  volatility=altitudeLoad*.04;
 }else if(family==='hockey'){
  altitudeTotal=-altitudeLoad*.018; altitudeHome=altitudeLoad*.07;
  paceEffect=-altitudeLoad*.025;
  volatility=altitudeLoad*.025;
 }else if(family==='combat'){
  altitudeTotal=-altitudeLoad*.02; altitudeHome=0;
  paceEffect=-altitudeLoad*.07;
  volatility=altitudeLoad*.12;
 }else{
  tempEffect=-extremeTemp*.08;windEffect=-windLoad*.12;precipEffect=-rainLoad*.10;
  altitudeHome=altitudeLoad*.04;volatility=windLoad*.12+rainLoad*.12;
 }

 const conditionSeverity=clamp01(extremeTemp*.18+windLoad*.26+gustLoad*.18+rainLoad*.24+snowLoad*.28+heat*humidityLoad*.08);
 const totalEffect=clamp(tempEffect+windEffect+precipEffect+humidityEffect+altitudeTotal+surfaceEffect+park*.12,-.65,.65);
 const homeEdge=clamp(altitudeHome,-.25,.25);
 const composite=clamp(totalEffect*.62+homeEdge*.23+paceEffect*.15,-1,1);
 const weatherFields=[temperature,humidity,finite(wx.windMph),finite(wx.precipitationProbability)].filter(x=>x!==undefined).length;
 const weatherConfidence=indoor ? .96 : clamp01(.48+weatherFields*.105+(finite(wx.windGustMph)!==undefined ? .05 : 0)+(finite(wx.apparentTemperatureF)!==undefined ? .03 : 0));
 const venueConfidence=elevation>0 ? .06 : 0;
 const confidence=clamp01(weatherConfidence+venueConfidence);

 return {
  venueWeatherComposite:composite,
  venueConditionSeverity:conditionSeverity,
  venueTotalEffect:totalEffect,
  venueHomeEdge:homeEdge,
  venuePaceEffect:clamp(paceEffect,-.45,.45),
  venueVolatilityEffect:clamp01(volatility),
  venueWeatherConfidence:confidence,
  venueTemperatureEffect:clamp(tempEffect),
  venueWindEffect:clamp(windEffect),
  venuePrecipEffect:clamp(precipEffect),
  venueHumidityEffect:clamp(humidityEffect),
  venueAltitudeEffect:clamp(altitudeTotal+altitudeHome),
  venueSurfaceEffect:clamp(surfaceEffect),
  venueIndoor:indoor?1:0,
  weather:clamp(totalEffect,-1,1)
 };
}

export function venueKey(name:string|undefined,city:string|undefined,state:string|undefined){
 return [name||'',city||'',state||''].join('|').toLowerCase().replace(/[^a-z0-9|]+/g,' ').replace(/\s+/g,' ').trim()||'unknown';
}

export async function recordVenueConditionSnapshots(markets:Market[]){
 const sql=db(); if(!sql)return 0;
 const observedHour=new Date(Math.floor(Date.now()/3600000)*3600000).toISOString();
 let written=0;
 const seen=new Set<string>();
 for(const m of markets){
  const f=m.sportFeatures||{};
  const confidence=Number(f.venueWeatherConfidence);
  if(!Number.isFinite(confidence)||confidence<=0)continue;
  const eventId=m.id.split(':')[0];
  const key=[m.sport,eventId].join('|');if(seen.has(key))continue;seen.add(key);
  const detail=(m.contextProvenance||[]).find(x=>x.providerId==='edgeforce-v68-venue-conditions')?.detail||{};
  const vKey=venueKey(String(detail.venue||''),String(detail.city||''),String(detail.state||''));
  await sql`
   insert into venue_condition_snapshots(
    sport,event_id,event_name,start_time,venue_key,venue_name,city,state,country,indoor,surface,elevation_ft,
    temperature_f,apparent_temperature_f,humidity_pct,precipitation_probability,precipitation_in,snowfall_in,
    wind_mph,wind_gust_mph,cloud_cover_pct,condition_severity,total_effect,home_edge,pace_effect,volatility_effect,
    confidence,observed_hour,metadata
   ) values(
    ${m.sport},${eventId},${m.event},${m.startTime},${vKey},${String(detail.venue||'')||null},
    ${String(detail.city||'')||null},${String(detail.state||'')||null},${String(detail.country||'')||null},
    ${Boolean(detail.indoor)},${String(detail.surface||'')||null},${finite(detail.elevationFt)??null},
    ${finite(detail.temperatureF)??null},${finite(detail.apparentTemperatureF)??null},${finite(detail.humidityPct)??null},
    ${finite(detail.precipProbability)??null},${finite(detail.precipitationIn)??null},${finite(detail.snowfallIn)??null},
    ${finite(detail.windMph)??null},${finite(detail.gustMph)??null},${finite(detail.cloudCoverPct)??null},
    ${Number(f.venueConditionSeverity)||0},${Number(f.venueTotalEffect)||0},${Number(f.venueHomeEdge)||0},
    ${Number(f.venuePaceEffect)||0},${Number(f.venueVolatilityEffect)||0},${confidence},${observedHour},
    ${sql.json({composite:Number(f.venueWeatherComposite)||0})}
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
  `;
  written++;
 }
 return written;
}

export async function rebuildVenueConditionProfiles(){
 const sql=db();
 if(!sql)return {configured:false,snapshotsRead:0,profilesWritten:0,venuesProfiled:0};
 const run=await sql`insert into venue_condition_runs(model_version) values(${process.env.MODEL_VERSION||'edgeforce-v61'}) returning id`;
 const runId=Number((run as any[])[0]?.id||0);
 const rows=await sql`
  select sport,venue_key as "venueKey",max(venue_name) as "venueName",count(*)::int as n,
         avg(case when indoor then 1 else 0 end)::float as "indoorRate",
         avg(temperature_f)::float as temp,avg(humidity_pct)::float as humidity,avg(wind_mph)::float as wind,
         avg(elevation_ft)::float as elevation,avg(condition_severity)::float as severity,
         avg(total_effect)::float as "totalEffect",avg(home_edge)::float as "homeEdge",
         avg(volatility_effect)::float as volatility,avg(confidence)::float as confidence
  from venue_condition_snapshots
  where observed_hour>now()-interval '365 days'
  group by sport,venue_key
 `;
 let written=0,total=0;
 for(const row of rows as any[]){
  total+=Number(row.n||0);
  await sql`
   insert into venue_condition_profiles(
    sport,venue_key,venue_name,sample_count,indoor_rate,avg_temperature_f,avg_humidity_pct,avg_wind_mph,
    avg_elevation_ft,avg_condition_severity,avg_total_effect,avg_home_edge,avg_volatility_effect,avg_confidence,updated_at,metadata
   ) values(
    ${row.sport},${row.venueKey},${row.venueName||null},${row.n},${row.indoorRate||0},${row.temp??null},
    ${row.humidity??null},${row.wind??null},${row.elevation??null},${row.severity||0},${row.totalEffect||0},
    ${row.homeEdge||0},${row.volatility||0},${row.confidence||0},now(),${sql.json({lookbackDays:365})}
   )
   on conflict (sport,venue_key) do update set
    venue_name=excluded.venue_name,sample_count=excluded.sample_count,indoor_rate=excluded.indoor_rate,
    avg_temperature_f=excluded.avg_temperature_f,avg_humidity_pct=excluded.avg_humidity_pct,avg_wind_mph=excluded.avg_wind_mph,
    avg_elevation_ft=excluded.avg_elevation_ft,avg_condition_severity=excluded.avg_condition_severity,
    avg_total_effect=excluded.avg_total_effect,avg_home_edge=excluded.avg_home_edge,
    avg_volatility_effect=excluded.avg_volatility_effect,avg_confidence=excluded.avg_confidence,updated_at=now(),metadata=excluded.metadata
  `;
  written++;
 }
 if(runId)await sql`update venue_condition_runs set snapshots_read=${total},profiles_written=${written},venues_profiled=${written},completed_at=now(),metadata=${sql.json({lookbackDays:365})} where id=${runId}`;
 return {configured:true,snapshotsRead:total,profilesWritten:written,venuesProfiled:written};
}

export async function loadVenueConditionSummary(){
 const sql=db();
 if(!sql)return {configured:false,snapshots24h:0,profiles:0,severe24h:0,recent:[]};
 const [counts,recent]=await Promise.all([
  sql`
   select
    (select count(*)::int from venue_condition_snapshots where observed_hour>now()-interval '24 hours') as "snapshots24h",
    (select count(*)::int from venue_condition_profiles) as profiles,
    (select count(*)::int from venue_condition_snapshots where observed_hour>now()-interval '24 hours' and condition_severity>=.45) as "severe24h"
  `,
  sql`
   select sport,event_name as "eventName",start_time as "startTime",venue_name as "venueName",indoor,surface,
          elevation_ft::float as "elevationFt",temperature_f::float as "temperatureF",humidity_pct::float as "humidityPct",
          wind_mph::float as "windMph",wind_gust_mph::float as "gustMph",precipitation_probability::float as "precipProbability",
          condition_severity::float as severity,total_effect::float as "totalEffect",home_edge::float as "homeEdge",
          volatility_effect::float as volatility,confidence::float as confidence
   from venue_condition_snapshots where observed_hour>now()-interval '24 hours'
   order by condition_severity desc,abs(total_effect) desc limit 30
  `
 ]);
 const c=(counts as any[])[0]||{};
 return {configured:true,snapshots24h:Number(c.snapshots24h||0),profiles:Number(c.profiles||0),severe24h:Number(c.severe24h||0),recent};
}
