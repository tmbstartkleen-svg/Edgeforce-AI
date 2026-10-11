import {db} from '@/lib/db';
import {authorizeNetwork,networkHeaders} from '@/lib/firstPartySportsNetwork';
import {summarizeBacktests,type BacktestSample} from '@/lib/identityBacktesting';
export const dynamic='force-dynamic';
type Row={
 eventId:string;sport:string;modelVersion:string;selection:string;
 modelProbability:number|string;homeScore:number|null;awayScore:number|null;
 homeName:string;awayName:string;canonicalHomeId:string|null;canonicalAwayId:string|null;
 predictionTime:string|Date;scheduledAt:string|Date;
 outcomeEvidence:string;upstreamCount:number|null;
};
type SourceRow={sourceId:string;upstreamOwner:string;retentionReviewed:boolean;
 independentSourceEnabled:boolean;reviewedAt:string|Date|null;reviewReference:string|null};
const fail=(status:string,code:number)=>Response.json({ok:false,status},{status:code,headers:networkHeaders});
export async function GET(request:Request){
 const auth=authorizeNetwork(request);if(auth)return auth;
 const sport=(new URL(request.url).searchParams.get('sport')||'').trim();
 if(sport&&!/^[A-Za-z0-9 _-]{2,28}$/.test(sport))return fail('INVALID_SPORT',400);
 const sql=db();if(!sql)return fail('DATABASE_NOT_CONFIGURED',503);
 try{
  const [records,sourceRows]=await Promise.all([
   sql<Row[]>`
    with latest as (
     select mr.id as model_id,mr.event_id,mr.model_version,mr.selection_key,
      mr.model_probability,mr.created_at,e.start_time,e.sport,
      e.home_team_id,e.away_team_id,
      coalesce(h.name,e.home_team_id) as home_name,
      coalesce(a.name,e.away_team_id) as away_name,
      row_number() over(
       partition by mr.event_id,mr.model_version
       order by mr.created_at desc,mr.id desc
      ) as rn
     from model_runs mr
     join events e on e.id=mr.event_id
     left join teams h on h.id=e.home_team_id
     left join teams a on a.id=e.away_team_id
     where lower(mr.market_key) in ('h2h','moneyline')
      and e.start_time<now()
      and e.start_time>now()-interval '120 days'
      and mr.created_at<e.start_time
      and (${sport}='' or lower(e.sport)=lower(${sport}))
    )
    select m.event_id as "eventId",m.sport,m.model_version as "modelVersion",
     m.selection_key as selection,m.model_probability as "modelProbability",
     coalesce(v.home_score,-1) as "homeScore",
     coalesce(v.away_score,-1) as "awayScore",
     m.home_name as "homeName",m.away_name as "awayName",
     m.home_team_id as "canonicalHomeId",m.away_team_id as "canonicalAwayId",
     m.created_at as "predictionTime",m.start_time as "scheduledAt",
     coalesce(v.evidence_status,'SINGLE_SOURCE') as "outcomeEvidence",
     coalesce(v.sources,0) as "upstreamCount"
    from latest m
    left join public.edgeforce_cross_source_finals_v210 v on v.event_id=m.event_id
    where m.rn=1 order by m.start_time desc,m.model_id desc limit 350`,
   sql<SourceRow[]>`
    select source_id as "sourceId",upstream_owner as "upstreamOwner",
     retention_reviewed as "retentionReviewed",
     independent_source_enabled as "independentSourceEnabled",
     reviewed_at as "reviewedAt",review_reference as "reviewReference"
    from public.edgeforce_score_sources_v210
    order by source_id limit 40`
  ]);
  const samples:BacktestSample[]=records.map(row=>({
   eventId:row.eventId,sport:row.sport,modelVersion:row.modelVersion,
   selection:row.selection,modelProbability:Number(row.modelProbability),
   homeScore:Number(row.homeScore),awayScore:Number(row.awayScore),
   homeName:row.homeName||'',awayName:row.awayName||'',
   canonicalHomeId:row.canonicalHomeId,canonicalAwayId:row.canonicalAwayId,
   predictionTime:new Date(row.predictionTime).toISOString(),
   scheduledAt:new Date(row.scheduledAt).toISOString(),
   outcomeEvidence:row.outcomeEvidence,upstreamCount:Number(row.upstreamCount)
  }));
  const report=summarizeBacktests(samples);
  return Response.json({
   ok:true,network:'EdgeForce Sports Network',version:'v210',
   asOf:new Date().toISOString(),lookbackDays:120,scannedLimit:350,
   consideredSourceProviders:sourceRows.map(x=>({
    sourceId:x.sourceId,upstreamOwner:x.upstreamOwner,
    retentionReviewed:x.retentionReviewed,independentSourceEnabled:x.independentSourceEnabled,
    reviewPresent:Boolean(x.reviewedAt&&x.reviewReference)
   })),
   ...report
  },{headers:networkHeaders});
 }catch{return fail('BACKTEST_DATABASE_OR_MIGRATION_UNAVAILABLE',503);}
}
