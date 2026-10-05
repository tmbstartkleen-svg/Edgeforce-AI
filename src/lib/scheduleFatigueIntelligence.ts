import {db} from './db';
import type {Market} from './types';

type AnyRow=Record<string,unknown>;

export type ScheduleVenue={name?:string;city?:string;state?:string;country?:string};
export type GeoPoint={latitude:number;longitude:number;timezone?:string};
export type ScheduleLoad={
 restDays?:number;
 games3d:number;games4d:number;games6d:number;games7d:number;
 backToBack:number;threeInFour:number;fourInSix:number;
 roadStreak:number;density:number;fatigueLoad:number;confidence:number;
 priorEventDate?:string;priorVenue?:ScheduleVenue;
};
export type TravelBurden={
 distanceMiles:number;timezoneShiftHours:number;eastward:number;
 recoveryFactor:number;burden:number;confidence:number;
};
export type ScheduleSignals={
 scheduleRestEdge:number;scheduleTravelEdge:number;scheduleFatigueEdge:number;scheduleDensityEdge:number;
 scheduleCompositeEdge:number;scheduleContextConfidence:number;scheduleUncertainty:number;
 rest:number;travel:number;fatigue:number;
 scheduleHomeRestDays:number;scheduleAwayRestDays:number;
 scheduleHomeTravelMiles:number;scheduleAwayTravelMiles:number;
 scheduleHomeTimezoneShift:number;scheduleAwayTimezoneShift:number;
 scheduleHomeFatigue:number;scheduleAwayFatigue:number;
 scheduleHomeGames7d:number;scheduleAwayGames7d:number;
 scheduleHomeRoadStreak:number;scheduleAwayRoadStreak:number;
};

const obj=(v:unknown):AnyRow=>v&&typeof v==='object'&&!Array.isArray(v)?v as AnyRow:{};
const arr=(v:unknown):unknown[]=>Array.isArray(v)?v:[];
const str=(v:unknown)=>typeof v==='string'?v:'';
const clamp=(n:number,min=-1,max=1)=>Math.max(min,Math.min(max,n));
const clamp01=(n:number)=>clamp(n,0,1);
const DAY=86400000;

function teamIdFromCompetitor(row:AnyRow){
 const team=obj(row.team);
 return str(team.id)||str(row.id);
}
function eventRows(payload:unknown){
 const root=obj(payload);
 return arr(root.events||payload).map(obj);
}
function venueFromEvent(event:AnyRow):ScheduleVenue|undefined{
 const competition=obj(arr(event.competitions)[0]);
 const venue=obj(competition.venue);
 const address=obj(venue.address);
 const out:ScheduleVenue={
  name:str(venue.fullName)||str(venue.name)||undefined,
  city:str(address.city)||undefined,
  state:str(address.state)||undefined,
  country:str(address.country)||undefined
 };
 return out.name||out.city?out:undefined;
}
function scheduleHistory(payload:unknown,targetIso:string,teamId:string){
 const target=new Date(targetIso).getTime();
 if(!Number.isFinite(target))return [] as Array<{date:string;time:number;homeAway:string;venue?:ScheduleVenue}>;
 const rows:Array<{date:string;time:number;homeAway:string;venue?:ScheduleVenue}>=[];
 for(const event of eventRows(payload)){
  const competition=obj(arr(event.competitions)[0]);
  const date=str(event.date)||str(competition.date);
  const time=new Date(date).getTime();
  if(!Number.isFinite(time)||time>=target-6*3600000)continue;
  const competitors=arr(competition.competitors).map(obj);
  const own=competitors.find(x=>teamIdFromCompetitor(x)===teamId);
  if(!own)continue;
  rows.push({date,time,homeAway:str(own.homeAway).toLowerCase(),venue:venueFromEvent(event)});
 }
 return rows.sort((a,b)=>b.time-a.time);
}

export function deriveScheduleLoad(payload:unknown,targetIso:string,teamId:string,currentHomeAway:'home'|'away'):ScheduleLoad{
 const target=new Date(targetIso).getTime();
 const history=scheduleHistory(payload,targetIso,teamId);
 if(!Number.isFinite(target)||!history.length){
  return {games3d:0,games4d:0,games6d:0,games7d:0,backToBack:0,threeInFour:0,fourInSix:0,roadStreak:currentHomeAway==='away'?1:0,density:0,fatigueLoad:0,confidence:0};
 }
 const previous=history[0];
 const restDays=Math.max(0,(target-previous.time)/DAY);
 const count=(days:number)=>history.filter(x=>target-x.time<=days*DAY).length;
 const games3d=count(3),games4d=count(4),games6d=count(6),games7d=count(7);
 const backToBack=restDays<=1.55?1:0;
 const threeInFour=games4d>=2?1:0;
 const fourInSix=games6d>=3?1:0;
 let roadStreak=currentHomeAway==='away'?1:0;
 if(currentHomeAway==='away'){
  for(const row of history){
   if(row.homeAway!=='away')break;
   roadStreak++;
  }
 }
 const density=clamp01((games7d+1)/5);
 const roadLoad=clamp01(Math.max(0,roadStreak-1)/4);
 const fatigueLoad=clamp01(backToBack*.42+threeInFour*.24+fourInSix*.18+density*.10+roadLoad*.12);
 const confidence=clamp01(.45+Math.min(history.length,8)/8*.45+(previous.venue?.city?0.10:0));
 return {restDays,games3d,games4d,games6d,games7d,backToBack,threeInFour,fourInSix,roadStreak,density,fatigueLoad,confidence,priorEventDate:previous.date,priorVenue:previous.venue};
}

export function haversineMiles(a:GeoPoint,b:GeoPoint){
 const rad=(n:number)=>n*Math.PI/180;
 const dLat=rad(b.latitude-a.latitude),dLon=rad(b.longitude-a.longitude);
 const la1=rad(a.latitude),la2=rad(b.latitude);
 const h=Math.sin(dLat/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dLon/2)**2;
 return 3958.7613*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));
}

function timezoneOffsetHours(timezone:string|undefined,atIso:string,longitude:number){
 if(timezone){
  try{
   const date=new Date(atIso);
   const parts=new Intl.DateTimeFormat('en-US',{timeZone:timezone,timeZoneName:'shortOffset',hour:'2-digit'}).formatToParts(date);
   const label=parts.find(x=>x.type==='timeZoneName')?.value||'';
   const match=label.match(/GMT([+-]\d{1,2})(?::(\d{2}))?/i);
   if(match){
    const hours=Number(match[1]),minutes=Number(match[2]||0);
    return hours+(hours<0?-minutes:minutes)/60;
   }
  }catch{}
 }
 return Math.max(-12,Math.min(14,longitude/15));
}

export function deriveTravelBurden(previous:GeoPoint|undefined,current:GeoPoint|undefined,restDays:number|undefined,atIso:string):TravelBurden{
 if(!previous||!current)return {distanceMiles:0,timezoneShiftHours:0,eastward:0,recoveryFactor:1,burden:0,confidence:0};
 const distanceMiles=haversineMiles(previous,current);
 const priorOffset=timezoneOffsetHours(previous.timezone,atIso,previous.longitude);
 const currentOffset=timezoneOffsetHours(current.timezone,atIso,current.longitude);
 const timezoneShiftHours=Math.abs(currentOffset-priorOffset);
 const eastward=currentOffset>priorOffset?1:0;
 const recoveryFactor=clamp01(1-Math.max(0,(restDays??1)-1)*.24);
 const distanceLoad=clamp01(distanceMiles/2200);
 const timezoneLoad=clamp01(timezoneShiftHours/3);
 const burden=clamp01((distanceLoad*.62+timezoneLoad*.28+eastward*timezoneLoad*.10)*recoveryFactor);
 const confidence=previous.timezone&&current.timezone?.length?0.92:0.78;
 return {distanceMiles,timezoneShiftHours,eastward,recoveryFactor,burden,confidence};
}

export function combineScheduleSignals(home:ScheduleLoad,away:ScheduleLoad,homeTravel:TravelBurden,awayTravel:TravelBurden):ScheduleSignals{
 const homeRest=home.restDays??2.5,awayRest=away.restDays??2.5;
 const restEdge=clamp((homeRest-awayRest)/3.5);
 const travelEdge=clamp(awayTravel.burden-homeTravel.burden);
 const fatigueEdge=clamp(away.fatigueLoad-home.fatigueLoad);
 const densityEdge=clamp((away.density-home.density)*1.4);
 const confidence=clamp01((home.confidence+away.confidence+homeTravel.confidence+awayTravel.confidence)/4);
 const composite=clamp(restEdge*.30+travelEdge*.25+fatigueEdge*.30+densityEdge*.15);
 const uncertainty=clamp01(1-confidence);
 return {
  scheduleRestEdge:restEdge,scheduleTravelEdge:travelEdge,scheduleFatigueEdge:fatigueEdge,scheduleDensityEdge:densityEdge,
  scheduleCompositeEdge:composite,scheduleContextConfidence:confidence,scheduleUncertainty:uncertainty,
  rest:restEdge,travel:clamp(homeTravel.burden-awayTravel.burden),fatigue:clamp(home.fatigueLoad-away.fatigueLoad),
  scheduleHomeRestDays:homeRest,scheduleAwayRestDays:awayRest,
  scheduleHomeTravelMiles:homeTravel.distanceMiles,scheduleAwayTravelMiles:awayTravel.distanceMiles,
  scheduleHomeTimezoneShift:homeTravel.timezoneShiftHours,scheduleAwayTimezoneShift:awayTravel.timezoneShiftHours,
  scheduleHomeFatigue:home.fatigueLoad,scheduleAwayFatigue:away.fatigueLoad,
  scheduleHomeGames7d:home.games7d+1,scheduleAwayGames7d:away.games7d+1,
  scheduleHomeRoadStreak:home.roadStreak,scheduleAwayRoadStreak:away.roadStreak
 };
}

export async function recordScheduleFatigueSnapshots(markets:Market[]){
 const sql=db(); if(!sql)return 0;
 const observedHour=new Date(Math.floor(Date.now()/3600000)*3600000).toISOString();
 let written=0;
 const seen=new Set<string>();
 for(const m of markets){
  const f=m.sportFeatures||{};
  const confidence=Number(f.scheduleContextConfidence);
  if(!Number.isFinite(confidence)||confidence<=0)continue;
  const eventId=m.id.split(':')[0],key=[m.sport,eventId].join('|');
  if(seen.has(key))continue;seen.add(key);
  await sql`
   insert into schedule_fatigue_snapshots(
    sport,event_id,event_name,start_time,home,away,home_rest_days,away_rest_days,home_travel_miles,away_travel_miles,
    home_timezone_shift,away_timezone_shift,home_fatigue,away_fatigue,rest_edge,travel_edge,fatigue_edge,density_edge,
    composite_edge,confidence,observed_hour,metadata
   ) values(
    ${m.sport},${eventId},${m.event},${m.startTime},${m.home},${m.away},
    ${Number(f.scheduleHomeRestDays)||null},${Number(f.scheduleAwayRestDays)||null},
    ${Number(f.scheduleHomeTravelMiles)||0},${Number(f.scheduleAwayTravelMiles)||0},
    ${Number(f.scheduleHomeTimezoneShift)||0},${Number(f.scheduleAwayTimezoneShift)||0},
    ${Number(f.scheduleHomeFatigue)||0},${Number(f.scheduleAwayFatigue)||0},
    ${Number(f.scheduleRestEdge)||0},${Number(f.scheduleTravelEdge)||0},${Number(f.scheduleFatigueEdge)||0},
    ${Number(f.scheduleDensityEdge)||0},${Number(f.scheduleCompositeEdge)||0},${confidence},${observedHour},
    ${sql.json({homeGames7d:Number(f.scheduleHomeGames7d)||0,awayGames7d:Number(f.scheduleAwayGames7d)||0,homeRoadStreak:Number(f.scheduleHomeRoadStreak)||0,awayRoadStreak:Number(f.scheduleAwayRoadStreak)||0})}
   )
   on conflict (sport,event_id,observed_hour) do update set
    event_name=excluded.event_name,start_time=excluded.start_time,home=excluded.home,away=excluded.away,
    home_rest_days=excluded.home_rest_days,away_rest_days=excluded.away_rest_days,
    home_travel_miles=excluded.home_travel_miles,away_travel_miles=excluded.away_travel_miles,
    home_timezone_shift=excluded.home_timezone_shift,away_timezone_shift=excluded.away_timezone_shift,
    home_fatigue=excluded.home_fatigue,away_fatigue=excluded.away_fatigue,
    rest_edge=excluded.rest_edge,travel_edge=excluded.travel_edge,fatigue_edge=excluded.fatigue_edge,
    density_edge=excluded.density_edge,composite_edge=excluded.composite_edge,confidence=excluded.confidence,metadata=excluded.metadata
  `;
  written++;
 }
 return written;
}

export async function rebuildScheduleFatigueProfiles(){
 const sql=db();
 if(!sql)return {configured:false,snapshotsRead:0,profilesWritten:0};
 const run=await sql`insert into schedule_fatigue_runs(model_version) values(${process.env.MODEL_VERSION||'edgeforce-v61'}) returning id`;
 const runId=Number((run as any[])[0]?.id||0);
 const rows=await sql`
  select sport,count(*)::int as n,
         avg(abs(rest_edge))::float as rest,avg(abs(travel_edge))::float as travel,
         avg(abs(fatigue_edge))::float as fatigue,avg(abs(density_edge))::float as density,
         avg(abs(composite_edge))::float as composite,avg(confidence)::float as confidence,
         avg(case when greatest(home_fatigue,away_fatigue)>=.55 then 1 else 0 end)::float as "highLoadRate"
  from schedule_fatigue_snapshots
  where observed_hour>now()-interval '180 days'
  group by sport
 `;
 let written=0,total=0;
 for(const row of rows as any[]){
  total+=Number(row.n||0);
  await sql`
   insert into schedule_fatigue_profiles(sport,sample_count,avg_abs_rest_edge,avg_abs_travel_edge,avg_abs_fatigue_edge,avg_abs_density_edge,avg_abs_composite_edge,avg_confidence,high_load_rate,updated_at,metadata)
   values(${row.sport},${row.n},${row.rest||0},${row.travel||0},${row.fatigue||0},${row.density||0},${row.composite||0},${row.confidence||0},${row.highLoadRate||0},now(),${sql.json({lookbackDays:180})})
   on conflict (sport) do update set
    sample_count=excluded.sample_count,avg_abs_rest_edge=excluded.avg_abs_rest_edge,avg_abs_travel_edge=excluded.avg_abs_travel_edge,
    avg_abs_fatigue_edge=excluded.avg_abs_fatigue_edge,avg_abs_density_edge=excluded.avg_abs_density_edge,
    avg_abs_composite_edge=excluded.avg_abs_composite_edge,avg_confidence=excluded.avg_confidence,
    high_load_rate=excluded.high_load_rate,updated_at=now(),metadata=excluded.metadata
  `;
  written++;
 }
 if(runId)await sql`update schedule_fatigue_runs set snapshots_read=${total},profiles_written=${written},completed_at=now(),metadata=${sql.json({lookbackDays:180})} where id=${runId}`;
 return {configured:true,snapshotsRead:total,profilesWritten:written};
}

export async function loadScheduleFatigueSummary(){
 const sql=db();
 if(!sql)return {configured:false,snapshots24h:0,profiles:0,highLoadEvents24h:0,sports:[],recent:[]};
 const [counts,sports,recent]=await Promise.all([
  sql`
   select
    (select count(*)::int from schedule_fatigue_snapshots where observed_hour>now()-interval '24 hours') as "snapshots24h",
    (select count(*)::int from schedule_fatigue_profiles) as profiles,
    (select count(*)::int from schedule_fatigue_snapshots where observed_hour>now()-interval '24 hours' and greatest(home_fatigue,away_fatigue)>=.55) as "highLoadEvents24h"
  `,
  sql`select sport,sample_count as "sampleCount",avg_abs_composite_edge::float as "avgComposite",avg_confidence::float as confidence,high_load_rate::float as "highLoadRate" from schedule_fatigue_profiles order by sample_count desc`,
  sql`
   select sport,event_name as "eventName",start_time as "startTime",home,away,
          home_rest_days::float as "homeRestDays",away_rest_days::float as "awayRestDays",
          home_travel_miles::float as "homeTravelMiles",away_travel_miles::float as "awayTravelMiles",
          home_fatigue::float as "homeFatigue",away_fatigue::float as "awayFatigue",
          composite_edge::float as "compositeEdge",confidence::float as confidence
   from schedule_fatigue_snapshots where observed_hour>now()-interval '24 hours'
   order by greatest(home_fatigue,away_fatigue) desc,abs(composite_edge) desc limit 30
  `
 ]);
 const c=(counts as any[])[0]||{};
 return {configured:true,snapshots24h:Number(c.snapshots24h||0),profiles:Number(c.profiles||0),highLoadEvents24h:Number(c.highLoadEvents24h||0),sports,recent};
}
