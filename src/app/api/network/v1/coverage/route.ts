import {db} from '@/lib/db';
import {authorizeNetwork,networkHeaders} from '@/lib/firstPartySportsNetwork';
import {GLOBAL_SPORT_REGISTRY} from '@/lib/sportRegistry';
export const dynamic='force-dynamic';
const fail=(status:string,code:number)=>Response.json({ok:false,status},{status:code,headers:networkHeaders});
type CountRow={sport:string;layer:string;records:string|number;lastEvent:Date|string|null};
type ScoreRow={id:string;source:string;sourceEventKey:string;sport:string;league:string;
 homeName:string;awayName:string;scheduledAt:Date|string;homeScore:number;awayScore:number;
 collectedAt:Date|string;sourceObservedAt:Date|string|null;verification:string};
type PlayRow={id:string;source:string;sourceEventKey:string;sourcePlayKey:string;sport:string;
 eventTime:Date|string;observedAt:Date|string|null;description:string;playerName:string|null;
 teamName:string|null;periodLabel:string|null;clockLabel:string|null;verification:string};
export async function GET(request:Request){
 const auth=authorizeNetwork(request);if(auth)return auth;
 const args=new URL(request.url).searchParams;
 const view=args.get('view')||'coverage';
 const sport=(args.get('sport')||'').trim();
 if(!['coverage','scores','plays'].includes(view)||sport&&!/^[A-Za-z0-9 _-]{2,28}$/.test(sport))
  return fail('INVALID_VIEW_OR_SPORT',400);
 const sql=db();if(!sql)return fail('DATABASE_NOT_CONFIGURED',503);
 try{
  if(view==='coverage'){
   // Counts are observed records, NOT percentage of every possible game in a league.
   const rows=await sql<CountRow[]>`
    with layers as (
     select sport,'FINAL_SCORE'::text as layer,count(*) as records,
      max(scheduled_at) as "lastEvent"
     from public.edgeforce_sports_outcomes_v209
     where scheduled_at>=now()-interval '365 days'
     group by sport
     union all
     select sport,'PLAY_BY_PLAY',count(*),max(event_time)
     from public.edgeforce_sports_plays_v209
     where event_time>=now()-interval '365 days'
     group by sport
     union all
     select sport,record_type,count(*),max(event_time)
     from public.edgeforce_sports_archive_v208
     where event_time>=now()-interval '365 days'
     group by sport,record_type
    )
    select sport,layer,records,"lastEvent"
    from layers order by sport,layer limit 240`;
   const coverage=new Map<string,{sport:string;layers:Record<string,number>;lastEvent:string|null}>();
   for(const row of rows){
    const key=row.sport.trim().toLowerCase();
    const stored=coverage.get(key)||{sport:row.sport,layers:{},lastEvent:null};
    stored.layers[row.layer]=Number(row.records);
    const date=row.lastEvent?new Date(row.lastEvent).toISOString():null;
    if(date&&(!stored.lastEvent||date>stored.lastEvent))stored.lastEvent=date;
    coverage.set(key,stored);
   }
   // Registered sports without actual storage get visible empty coverage, not fake data.
   for(const feed of GLOBAL_SPORT_REGISTRY){
    const key=feed.label.toLowerCase();
    if(!coverage.has(key))coverage.set(key,{sport:feed.label,layers:{},lastEvent:null});
   }
   const selected=[...coverage.values()].filter(x=>!sport||x.sport.toLowerCase()===sport.toLowerCase());
   selected.sort((a,b)=>a.sport.localeCompare(b.sport));
   return Response.json({ok:true,network:'EdgeForce Sports Network',version:'v209',
    dataRole:'OBSERVED_DATABASE_COMPLETENESS',windowDays:365,
    totalRegistrySports:GLOBAL_SPORT_REGISTRY.length,
    recordedSports:selected.filter(x=>Object.keys(x.layers).length>0).length,
    sports:selected.map(x=>({...x,coveredByRecords:Object.keys(x.layers).length>0,
     finalScoresAreIndependent:false,playByPlayCertified:false})),
    sourceScoreWritesEnabled:process.env.EDGEFORCE_OUTCOME_CAPTURE_ENABLED==='true',
    licensedPlayImportEnabled:process.env.EDGEFORCE_PLAY_IMPORT_ENABLED==='true',
    warning:'Sports in the registry are not proof of collected data. Counts are historical records, NOT percent game coverage, provider availability, official result certification or accuracy.'},
    {headers:networkHeaders});
  }
  if(view==='scores'){
   const rows=await sql<ScoreRow[]>`
    select id::text as id,source,source_event_key as "sourceEventKey",sport,league,
     home_name as "homeName",away_name as "awayName",scheduled_at as "scheduledAt",
     home_score as "homeScore",away_score as "awayScore",
     collected_at as "collectedAt",source_observed_at as "sourceObservedAt",
     verification
    from public.edgeforce_sports_outcomes_v209
    where scheduled_at>=now()-interval '365 days'
     and (${sport}='' or lower(sport)=lower(${sport}))
    order by scheduled_at desc,id desc limit 40`;
   return Response.json({ok:true,view:'scores',entries:rows.map(r=>({
    ...r,scheduledAt:new Date(r.scheduledAt).toISOString(),
    collectedAt:new Date(r.collectedAt).toISOString(),
    sourceObservedAt:r.sourceObservedAt?new Date(r.sourceObservedAt).toISOString():null,
    officialFinalVerified:false,independentSourceCount:1
   })),warning:'Provider-declared FINAL scores and corrections; not corroborated as official results.'},
   {headers:networkHeaders});
  }
  const rows=await sql<PlayRow[]>`
   select id::text as id,source,source_event_key as "sourceEventKey",
    source_play_key as "sourcePlayKey",sport,event_time as "eventTime",
    observed_at as "observedAt",description,player_name as "playerName",
    team_name as "teamName",period_label as "periodLabel",
    clock_label as "clockLabel",verification
   from public.edgeforce_sports_plays_v209
   where event_time>=now()-interval '365 days'
    and (${sport}='' or lower(sport)=lower(${sport}))
   order by event_time desc,id desc limit 40`;
  return Response.json({ok:true,view:'plays',entries:rows.map(r=>({
   ...r,eventTime:new Date(r.eventTime).toISOString(),
   observedAt:r.observedAt?new Date(r.observedAt).toISOString():null,
   independentSourceCount:1,officialEventVerified:false
  })),warning:'Licensed, operator-declared play-by-play records, not independently certified.'},
  {headers:networkHeaders});
 }catch{return fail('COVERAGE_DATA_NOT_AVAILABLE_OR_MIGRATION_MISSING',503)}
}
