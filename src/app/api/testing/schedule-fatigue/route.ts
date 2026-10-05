import {combineScheduleSignals,deriveScheduleLoad,deriveTravelBurden,haversineMiles} from '@/lib/scheduleFatigueIntelligence';

export const dynamic='force-dynamic';

const event=(id:string,date:string,homeAway:'home'|'away',teamId='A',city='City')=>({
 id,date,
 competitions:[{date,venue:{fullName:city+' Arena',address:{city,state:'OH',country:'USA'}},competitors:[
  {homeAway,team:{id:teamId}},
  {homeAway:homeAway==='home'?'away':'home',team:{id:'X'+id}}
 ]}]
});

export async function GET(){
 if(process.env.ENABLE_TEST_ENDPOINTS!=='true')return new Response(null,{status:404});
 const target='2026-10-10T00:00:00Z';
 const homeSchedule={events:[event('1','2026-10-08T00:00:00Z','home'),event('2','2026-10-05T00:00:00Z','home')]};
 const awaySchedule={events:[event('3','2026-10-09T00:00:00Z','away','B','Road'),event('4','2026-10-07T00:00:00Z','away','B','Road'),event('5','2026-10-05T00:00:00Z','away','B','Road')]};
 const home=deriveScheduleLoad(homeSchedule,target,'A','home');
 const away=deriveScheduleLoad(awaySchedule,target,'B','away');
 const homeTravel=deriveTravelBurden({latitude:39.96,longitude:-83,timezone:'America/New_York'},{latitude:39.96,longitude:-83,timezone:'America/New_York'},home.restDays,target);
 const awayTravel=deriveTravelBurden({latitude:34.05,longitude:-118.24,timezone:'America/Los_Angeles'},{latitude:39.96,longitude:-83,timezone:'America/New_York'},away.restDays,target);
 const signals=combineScheduleSignals(home,away,homeTravel,awayTravel);
 const distance=haversineMiles({latitude:34.05,longitude:-118.24},{latitude:39.96,longitude:-83});
 const ok=away.backToBack===1&&away.roadStreak>=3&&away.fatigueLoad>home.fatigueLoad&&awayTravel.distanceMiles>1500&&awayTravel.timezoneShiftHours>=2&&signals.scheduleCompositeEdge>0&&distance>1500;
 return Response.json({ok,build:'V67',schemaVersion:'v67-schedule-fatigue-1',home,away,homeTravel,awayTravel,signals,distanceMiles:distance},{headers:{'Cache-Control':'no-store'}});
}
